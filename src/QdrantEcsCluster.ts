import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CustomDomain } from './CustomDomain';

interface QdrantConfiguration {
  qdrantPort?: number;
}
interface QdrantEcsClusterOverrides {
  readonly cluster?: ecs.ClusterProps;
  readonly fargateService?: ecsPatterns.ApplicationLoadBalancedFargateServiceProps;
}
interface QdrantEcsClusterProps {
  /**
     * Qdrant server configuration.
     */
  readonly configuration?: QdrantConfiguration;
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
  readonly qdrantDockerImagePath: string;
  /**
   * @see {@link CustomDomain}
   */
  readonly customDomain?: CustomDomain;
  /**
     * Override props for every construct.
     */
  readonly overrides?: QdrantEcsClusterOverrides;
}


class QdrantEcsCluster extends Construct {
  public fargateService: ecsPatterns.ApplicationLoadBalancedFargateService;
  public qdrantPort: number;

  constructor(scope: Construct, id: string, props: QdrantEcsClusterProps) {
    super(scope, id);
    this.qdrantPort = props.configuration?.qdrantPort ?? 80;
    const cluster = new ecs.Cluster(this, 'QdrantCluster', {
      vpc: props.vpc,
      ...props.overrides?.cluster,
    });
    const image = ecs.ContainerImage.fromRegistry('qdrant/qdrant:latest');
    this.fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'QdrantFargateService', {
      cluster: cluster,
      listenerPort: this.qdrantPort,
      domainName: props.customDomain?.domainName,
      domainZone: props.customDomain?.hostedZone,
      certificate: props.customDomain?.certificate,
      ...props.overrides?.fargateService,
      taskImageOptions: {
        containerPort: this.qdrantPort,
        image,
        ...props.overrides?.fargateService?.taskImageOptions,
        environment: {
          QDRANT__STORAGE__STORAGE_PATH:
                        props.fileSystemMountPointPath + '/qdrantdata',
          QDRANT__SERVICE__HTTP_PORT: '80',
          ...props.overrides?.fargateService?.taskImageOptions?.environment,
        },
      },
    });
    const volumeName = 'mainEfs';
    this.fargateService.taskDefinition.addVolume({
      name: volumeName,
      efsVolumeConfiguration: {
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
      healthyHttpCodes: '200,204',
    });
  }
}

export {
  QdrantEcsClusterOverrides,
  QdrantEcsClusterProps,
  QdrantEcsCluster,
};