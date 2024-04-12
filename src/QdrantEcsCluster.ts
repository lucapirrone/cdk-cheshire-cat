import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as elb2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { CustomDomain } from './CustomDomain';

interface QdrantEcsClusterOverrides {
  readonly cluster?: ecs.ClusterProps;
  readonly fargateService?: Omit<ecsPatterns.ApplicationLoadBalancedFargateServiceProps, 'taskImageOptions'> & {
    taskImageOptions: Omit<ecsPatterns.ApplicationLoadBalancedTaskImageOptions, 'image'>;
  };
}
interface QdrantEcsClusterProps {
  /**
     * VPC to launch the ecs cluster in.
     */
  readonly vpc: ec2.IVpc;
  /**
     * Attached file system.
     */
  readonly efs: efs.FileSystem;
  /**
     * The path on the container to mount the host volume at.
     */
  readonly fileSystemMountPointPath: string;
  /**
     * Custom Qdrant container docker image.
     */
  readonly customQdrantContainerImage?: ecs.ContainerImage;
  /**
   * Qdrant Api Key from Secrets Manager
   */
  readonly qdrantApiKeySecret?: sm.ISecret;
  /**
   * @see {@link CustomDomain}
   */
  readonly qdrantDomain?: CustomDomain;
  /**
     * Override props for every construct.
     */
  readonly overrides?: QdrantEcsClusterOverrides;
}


class QdrantEcsCluster extends Construct {
  public fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: QdrantEcsClusterProps) {
    super(scope, id);
    const cluster = new ecs.Cluster(this, 'QdrantCluster', {
      vpc: props.vpc,
      ...props.overrides?.cluster,
    });
    const image = props.customQdrantContainerImage ?? ecs.ContainerImage.fromRegistry('qdrant/qdrant:v1.7.2');
    var accessPoint = new efs.AccessPoint(this, 'QdrantVolumeAccessPoint', {
      fileSystem: props.efs,
      path: '/qdrant',
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '755',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });
    this.fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'QdrantFargateService', {
      cluster: cluster,
      assignPublicIp: true,
      domainName: props.qdrantDomain?.hostedZone ? props.qdrantDomain?.fullDomain : undefined,
      domainZone: props.qdrantDomain?.hostedZone,
      ...props.overrides?.fargateService,
      taskImageOptions: {
        image,
        ...props.overrides?.fargateService?.taskImageOptions,
        environment: {
          QDRANT__STORAGE__STORAGE_PATH:
            props.fileSystemMountPointPath + '/qdrantdata',
          QDRANT__SERVICE__HTTP_PORT: '80',
          ...props.overrides?.fargateService?.taskImageOptions?.environment,
        },
        secrets: {
          ...(props.qdrantApiKeySecret ? { QDRANT__SERVICE__API_KEY: ecs.Secret.fromSecretsManager(props.qdrantApiKeySecret) } : {}),
          ...props.overrides?.fargateService?.taskImageOptions?.secrets,
        },
      },
    });
    if (props.qdrantDomain && props.qdrantDomain.certificate) {
      this.fargateService.loadBalancer.addListener('QdrantHttpsListener', {
        protocol: elb2.ApplicationProtocol.HTTPS,
        port: 443,
        certificates: [
          elb2.ListenerCertificate.fromCertificateManager(props.qdrantDomain.certificate),
        ],
        defaultTargetGroups: [
          this.fargateService.targetGroup,
        ],
      });
    }
    const volumeName = 'mainEfs';
    this.fargateService.taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
        authorizationConfig: {
          accessPointId: accessPoint.accessPointId,
          iam: 'ENABLED',
        },
        transitEncryption: 'ENABLED',
        fileSystemId: props.efs.fileSystemId,
      },
    });
    this.fargateService.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: props.fileSystemMountPointPath,
      readOnly: false,
      sourceVolume: volumeName,
    });
    this.fargateService.service.connections.allowFrom(props.efs, ec2.Port.tcp(2049));
    this.fargateService.service.connections.allowTo(props.efs, ec2.Port.tcp(2049));
    this.fargateService.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'elasticfilesystem:ClientRootAccess',
          'elasticfilesystem:ClientWrite',
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:DescribeMountTargets',
        ],
        resources: [
          `arn:aws:elasticfilesystem:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account
          }:file-system/${props.efs.fileSystemId}`,
        ],
      }),
    );
    this.fargateService.targetGroup.configureHealthCheck({
      path: '/',
      interval: cdk.Duration.seconds(60),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      timeout: cdk.Duration.seconds(30),
      healthyHttpCodes: '200,204',
    });
  }
}

export {
  QdrantEcsClusterOverrides,
  QdrantEcsClusterProps,
  QdrantEcsCluster,
};