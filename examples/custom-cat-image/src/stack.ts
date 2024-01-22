import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as path from 'path' 

export class CustomCatImage extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const image = ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'core'))

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      overrides: {
        catEcsCluster: {
          fargateService: {
            taskImageOptions: {
              image
            }
          }
        }
      }
    });

    new CfnOutput(this, "CatHost", {
      value: cheshireCat.catEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, "QdrantHost", {
      value: cheshireCat.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
