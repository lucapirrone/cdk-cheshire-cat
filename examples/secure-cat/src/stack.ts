import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as path from 'path' 

export class SecureCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const image = ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'core'))

    const catApiKeySecret = new sm.Secret(this, 'CatApiKey', {
      secretName: 'cat-api-key'
    })
    const qdrantApiKeySecret = new sm.Secret(this, 'QdrantApiKey', {
      secretName: 'qdrant-api-key'
    })

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      overrides: {
        catEcsCluster: {
          fargateService: {
            taskImageOptions: {
              image
            }
          }
        }
      },
      catApiKeySecret,
      qdrantApiKeySecret,
    });

    new CfnOutput(this, "CatHost", {
      value: cheshireCat.catEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, "QdrantHost", {
      value: cheshireCat.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
