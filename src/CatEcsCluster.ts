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
import { QdrantEcsCluster } from './QdrantEcsCluster';


type CatEnvVariables = {
  WATCHFILES_FORCE_POLLING: string;
  CORE_USE_SECURE_PROTOCOLS: string;
  CORE_HOST: string;
  CORE_PORT: string;
  API_KEY: string;
  METADATA_FILE?: string;
  LOG_LEVEL?: string;
  DEBUG?: string;
  SAVE_MEMORY_SNAPSHOTS?: string;
  AWS_REGION: string;
  CORS_ALLOWED_ORIGINS: string;
  QDRANT_HOST?: string;
  QDRANT_PORT?: string;
  QDRANT_HTTPS?: string;
} & Record<string, string>

interface CatEcsClusterOverrides {
  readonly cluster?: ecs.ClusterProps;
  readonly fargateService?: ecsPatterns.ApplicationLoadBalancedFargateServiceProps;
}
interface CatEcsClusterProps {
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
     * Qdrant docker image local path.
     */
  readonly catDockerImagePath: string;
  /**
     * Qdrant Ecs Cluster Construct.
     */
  readonly qdrantEcsCluster: QdrantEcsCluster;
  /**
     * Cat environment variables.
     */
  readonly catEnvVariables?: CatEnvVariables;
  /**
   * @see {@link CustomDomain}
   */
  readonly catDomain?: CustomDomain;
  /**
   * @see {@link CustomDomain}
   */
  readonly qdrantDomain?: CustomDomain;
  /**
   * Qdrant Api Key from Secrets Manager
   */
  readonly qdrantApiKeySecret?: sm.ISecret;
  /**
   * Cat Api Key from Secrets Manager
   */
  readonly catApiKeySecret?: sm.ISecret;
  /**
     * Override props for every construct.
     */
  readonly overrides?: CatEcsClusterOverrides;
}

class CatEcsCluster extends Construct {
  fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: CatEcsClusterProps) {
    super(scope, id);
    const cluster = new ecs.Cluster(this, 'CatCluster', {
      vpc: props.vpc,
      ...props.overrides?.cluster,
    });
    const image = ecs.ContainerImage.fromRegistry('ghcr.io/cheshire-cat-ai/core:latest');
    var accessPoint = new efs.AccessPoint(this, 'CatVolumeAccessPoint', {
      fileSystem: props.efs,
      path: props.fileSystemMountPointPath,
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
    this.fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'CatFargateService', {
      cluster: cluster,
      assignPublicIp: false,
      domainName: props.catDomain?.hostedZone ? props.catDomain?.fullDomain : undefined,
      domainZone: props.catDomain?.hostedZone,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      ...props.overrides?.fargateService,
      taskImageOptions: {
        image,
        ...props.overrides?.fargateService?.taskImageOptions,
        environment: {
          WATCHFILES_FORCE_POLLING: 'false',
          CORE_USE_SECURE_PROTOCOLS: props.catDomain ? 'true' : 'false',
          CORE_PORT: props.catDomain ? '443' : '80',
          METADATA_FILE: `${props.fileSystemMountPointPath}/metadata.json`,
          QDRANT_HOST: `${props.qdrantDomain?.hostedZone ? `https://${props.qdrantDomain?.fullDomain}` : `http://${props.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName}`}`,
          QDRANT_PORT: props.qdrantDomain?.hostedZone ? '443' : '80',
          ...props.overrides?.fargateService?.taskImageOptions?.environment,
        },
        secrets: {
          ...( props.qdrantApiKeySecret ? { QDRANT_API_KEY: ecs.Secret.fromSecretsManager(props.qdrantApiKeySecret) } : {}),
          ...( props.catApiKeySecret ? { API_KEY: ecs.Secret.fromSecretsManager(props.catApiKeySecret) } : {}),
          ...props.overrides?.fargateService?.taskImageOptions?.secrets,
        },
      },
    });
    if (props.catDomain && props.catDomain.certificate) {
      this.fargateService.loadBalancer.addListener('CatHttpsListener', {
        protocol: elb2.ApplicationProtocol.HTTPS,
        port: 443,
        certificates: [
          elb2.ListenerCertificate.fromCertificateManager(props.catDomain.certificate),
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
      interval: cdk.Duration.seconds(120),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      timeout: cdk.Duration.seconds(60),
      healthyHttpCodes: '200,204,403',
    });
    props.qdrantEcsCluster.fargateService.service.connections.allowTo(
      props.qdrantEcsCluster.fargateService.cluster,
      ec2.Port.tcp(2049),
      'Allow NFS traffic from the Assistant ECS tasks.',
    );
    props.qdrantEcsCluster.fargateService.service.connections.allowTo(
      props.qdrantEcsCluster.fargateService.cluster,
      ec2.Port.tcp(6333),
      'Allow Qdrant traffic from the Assistant ECS tasks.',
    );
    props.qdrantEcsCluster.fargateService.service.connections.allowTo(
      props.qdrantEcsCluster.fargateService.cluster,
      ec2.Port.tcp(6333),
      'Allow Qdrant traffic from the Assistant ECS tasks.',
    );
  }
}


export {
  CatEcsClusterOverrides,
  CatEcsClusterProps,
  CatEcsCluster,
  CatEnvVariables,
};