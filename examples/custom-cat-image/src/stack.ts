import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as path from 'path'

export class CustomCatImage extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const qdrantImage = ecs.ContainerImage.fromRegistry('qdrant/qdrant:v1.7.2');
    const catImage = ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'core'));

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      customQdrantContainerImage: qdrantImage,
      customCatContainerImage: catImage,
      // Disable catPluginFolderInEFS to include local plugins
      catPluginFolderInEFS: false
    });

    new CfnOutput(this, "CatHost", {
      value: cheshireCat.catEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, "QdrantHost", {
      value: cheshireCat.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
