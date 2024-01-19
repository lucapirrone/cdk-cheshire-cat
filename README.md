## What is this?

A CDK construct to deploy a Cheshire Cat project using the AWS Cloud Development Kit (CDK). The project's infrastructure includes setting up a Qdrant server, the vector search engine, as part of its architecture.

## Quickstart

```ts
import { CfnOutput, Stack, StackProps, App } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';

export class SimpleCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat');

    new CfnOutput(this, "CatHost", {
      value: cheshireCat.catEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
    new CfnOutput(this, "QdrantHost", {
      value: cheshireCat.qdrantEcsCluster.fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}

const app = new App();
new SimpleCat(app, 'simple');
```

## Examples

See example CDK apps [here](./examples) including:

- Sample Cat: CCat instance including qdrant server
- Custom Cat Image: CCat instance with custom local cat docker image including qdrant server
- Secure Cat: CCat instance using api keys in both qdrant and cat
- Custom Domain: CCat instance using custom domain

To deploy an example, make sure to read the [README.md](./examples/README.md)

## Infrastructure

* **EFS (Elastic File System):** Centralized storage for persistent data, utilized by both the Qdrant server and the Cheshire Cat application.
* **ECS Cluster (Fargate) for Qdrant:** Hosts the Qdrant server, integrated with EFS for data storage and retrieval.

* **ECS Cluster (Fargate) for Cheshire Cat:** Dedicated cluster running the Docker container of the Cheshire Cat application.
