import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';

export class DomainCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      domainProps: {
        catDomainProps: {
          domainName: 'lucapirrone.com',
          subDomain: 'cat'
        },
        qdrantDomainProps: {
          domainName: 'lucapirrone.com',
          subDomain: 'qdrant'
        }
      }
    });

    new CfnOutput(this, "CatHost", {
      value: cheshireCat.domain?.catDomain.domainName ?? cheshireCat.catEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, "QdrantHost", {
      value: cheshireCat.domain?.qdrantDomain.domainName ?? cheshireCat.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
