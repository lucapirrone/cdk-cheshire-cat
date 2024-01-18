import * as path from 'path';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
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
     * Override props for every construct.
     */
  readonly overrides?: CdkCheshireCatOverrides;
}

class CdkCheshireCat extends Construct {
  protected props: CdkCheshireCatProps;
  public qdrantEcsCluster: QdrantEcsCluster;
  public catEcsCluster: CatEcsCluster;
  public domain?: Domain;

  constructor(scope: Construct, id: string, props: CdkCheshireCatProps = {}) {
    super(scope, id);
    this.props = props;

    const vpc = this.createVpc();


    if (props.domainProps) {
      this.domain = new Domain(this, 'Domain', {
        ...props.domainProps,
        overrides: props.overrides?.Domain,
      });
    }

    const fileSystem = new efs.FileSystem(this, 'MainEfs', {
      vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      encrypted: true,
      ...props.overrides?.fileSystem,
    });

    this.qdrantEcsCluster = new QdrantEcsCluster(this, 'QdrantEcsCluster', {
      efs: fileSystem,
      vpc,
      fileSystemMountPointPath: '/mnt/efs/fs1',
      qdrantDockerImagePath: path.resolve(__dirname, './docker-images/qdrant'),
      overrides: props.overrides?.qdrantEcsCluster,
    });

    this.catEcsCluster = new CatEcsCluster(this, 'CatEcsCluster', {
      efs: fileSystem,
      vpc,
      fileSystemMountPointPath: '/mnt/efs/fs1',
      catDockerImagePath: path.resolve(__dirname, './docker-images/cheshire-cat'),
      qdrantEcsCluster: this.qdrantEcsCluster,
      overrides: props.overrides?.catEcsCluster,
    });

    if (this.domain) {
      this.domain.catDomain.createDnsRecords(this.catEcsCluster.fargateService.loadBalancer);
      this.domain.qdrantDomain.createDnsRecords(this.qdrantEcsCluster.fargateService.loadBalancer);
    }
  }

  private createVpc(): ec2.IVpc {
    return (
      this.props.vpc ??
      new ec2.Vpc(this, 'Vpc', {
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