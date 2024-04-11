import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { CatEcsCluster, CatEcsClusterOverrides } from './CatEcsCluster';
import { Domain, DomainOverrides, DomainProps } from './Domain';
import { QdrantEcsCluster, QdrantEcsClusterOverrides } from './QdrantEcsCluster';


interface CdkCheshireCatOverrides {
  readonly fileSystem?: efs.FileSystemProps;
  readonly qdrantEcsCluster?: QdrantEcsClusterOverrides;
  readonly catEcsCluster?: CatEcsClusterOverrides;
  readonly Domain?: DomainOverrides;
  readonly vpc?: ec2.VpcProps;
}
interface CdkCheshireCatProps {
  /**
     * VPC to launch the file system in.
     */
  readonly vpc?: ec2.IVpc;
  /**
   * Props to configure {@link Domain}. See details on how to customize at
   * {@link DomainProps}
   */
  readonly domainProps?: DomainProps;
  /**
   * Qdrant Api Key from Secrets Manager
   */
  readonly qdrantApiKeySecret?: sm.ISecret;
  /**
   * Cat Api Key from Secrets Manager
   */
  readonly catApiKeySecret?: sm.ISecret;
  /**
     * Custom Qdrant container docker image.
     */
  readonly customQdrantContainerImage?: ecs.ContainerImage;
  /**
     * Custom Cat container docker image.
     */
  readonly customCatContainerImage?: ecs.ContainerImage;
  /**
     * Persist cat plugins.
     * Enabling it will ignore the plugins inserted into the docker image
     * Default: true
     */
  readonly persistCatPlugins?: boolean;
  /**
     * Override props for every construct.
     */
  readonly overrides?: CdkCheshireCatOverrides;
}

class CdkCheshireCat extends Construct {
  protected props: CdkCheshireCatProps;
  public qdrantEcsCluster: QdrantEcsCluster;
  public catEcsCluster: CatEcsCluster;
  public fileSystem: efs.FileSystem;
  public securityGroup: ec2.SecurityGroup;
  public vpc: ec2.IVpc;
  public domain?: Domain;

  constructor(scope: Construct, id: string, { persistCatPlugins = true, ...props }: CdkCheshireCatProps = {}) {
    super(scope, id);
    this.props = props;

    this.vpc = this.createVpc();

    if (props.domainProps) {
      this.domain = new Domain(this, 'Domain', {
        ...props.domainProps,
        overrides: props.overrides?.Domain,
      });
    }

    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      securityGroupName: `${scope.node.id}-security-group`,
      vpc: this.vpc,
    });
    this.securityGroup.addIngressRule(
      this.securityGroup,
      ec2.Port.tcp(2049),
    );
    this.fileSystem = new efs.FileSystem(this, 'MainEfs', {
      vpc: this.vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      encrypted: true,
      securityGroup: this.securityGroup,
      ...props.overrides?.fileSystem,
    });

    this.qdrantEcsCluster = new QdrantEcsCluster(this, 'QdrantEcsCluster', {
      efs: this.fileSystem,
      vpc: this.vpc,
      fileSystemMountPointPath: '/mnt/efs/fs1',
      customQdrantContainerImage: props.customQdrantContainerImage,
      qdrantApiKeySecret: props.qdrantApiKeySecret,
      qdrantDomain: this.domain?.qdrantDomain,
      overrides: props.overrides?.qdrantEcsCluster,
    });

    this.catEcsCluster = new CatEcsCluster(this, 'CatEcsCluster', {
      efs: this.fileSystem,
      vpc: this.vpc,
      fileSystemMountPointPath: persistCatPlugins ? '/app/cat/plugins' : '/mnt/efs/fs1',
      customCatContainerImage: props.customCatContainerImage,
      qdrantEcsCluster: this.qdrantEcsCluster,
      qdrantApiKeySecret: props.qdrantApiKeySecret,
      catApiKeySecret: props.catApiKeySecret,
      catDomain: this.domain?.catDomain,
      qdrantDomain: this.domain?.qdrantDomain,
      overrides: props.overrides?.catEcsCluster,
    });
  }

  private createVpc(): ec2.IVpc {
    return (
      this.props.vpc ??
      new ec2.Vpc(this, 'Vpc', {
        vpcName: `${this.node.id}-vpc`,
        maxAzs: 3,
        natGateways: 0,
        subnetConfiguration: [
          {
            name: `${this.node.id}-public-subnet`,
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
        ],
        ...this.props.overrides?.vpc,
      })
    );
  }
}


export {
  CdkCheshireCatOverrides,
  CdkCheshireCatProps,
  CdkCheshireCat,
};