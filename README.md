![1705925803352](image/README/cheshire-cat-rocket-cloud.png)

## What is this?

CDK construct library that allows you to create a [Cheshire Cat](https://github.com/cheshire-cat-ai/core) using the AWS Cloud Development Kit (CDK) in TypeScript. The project's infrastructure includes setting up a Qdrant server, the vector search engine, as part of its architecture.

> **CAUTION**
> cdk-cheshire-cat needs cheshire cat core version **>=** 1.4.8

## Quickstart

### Installation

Use the [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) package manager to install the package

```bash
npm install cdk-cheshire-cat
```

### Usage

Use the construct in your CDK application:

```ts
import { CdkCheshireCat } from 'cdk-cheshire-cat';

new CdkCheshireCat(this, 'CheshireCat');
```

### Deployment

1. Configure AWS CLI as per instruction [Get started with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html)
2. Run `cdk bootstrap`
3. Run `cdk deploy`
4. Wait a few minutes for the deployment to complete
   ![1705925307100](image/README/1705925307100.png)
5. Go to CatHost output url with /admin to access the CheshireCat admin
6. Go to QdrantHost output url with /dashboard to access the Qdrant Server dashboard

## Infrastructure (AWS)

* **ECS Cluster (Fargate) for Qdrant:** Hosts the Qdrant server, integrated with EFS for data storage and retrieval.
* **ECS Cluster (Fargate) for Cheshire Cat:** Dedicated cluster running the Docker container of the Cheshire Cat application.
* **EFS (Elastic File System):** Centralized storage for persistent data, utilized by both the Qdrant server and the Cheshire Cat application.

## Examples

### All default

The simplest example shows all defaults below.

```ts
import { CfnOutput, Stack, StackProps, App } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';

export class DefaultCat extends Stack {
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
new DefaultCat(app, 'default');
```

The initial deployment takes a few minutes, after which a URL for CheshireCat and one for Qdrant Server will appear in the terminal. After a few minutes of adjustment, the services will be available at the relevant URLs.

By default, all the following are created:

* A VPC
* An Internet-facing load balancer serving HTTP (not HTTPS) traffic for CheshireCat server
* An ECS cluster with CheshireCat running on it
* An Internet-facing load balancer serving HTTP (not HTTPS) traffic for Qdrant server
* An ECS cluster with Qdrant server running on it
* An EFS mounted on both qdrant and cheshirecat tasks to storage permanent data

### Custom Cat Image

If you need to use a custom docker image for the cat you can replace the default one like this:

```typescript
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as cdk from 'aws-cdk-lib'
import * as path from 'path'

export class CustomCatImage extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    const qdrantImage = ecs.ContainerImage.fromRegistry('qdrant/qdrant:v1.7.2');
    // You have to link the Dockerfile folder, for example ./core
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

const app = new cdk.App();
new CustomCatImage(app, 'custom-cat-image');
```

### Secure Cat

To run a Cheshire Cat ready for production you definitely need to secure both the cat and the qdrant server by setting api keys.
You can set the Cheshire Cat and Qdrant Server api keys by passing the [AWS Secrects](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager.Secret.html) to the cdk construct.

```typescript
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as cdk from 'aws-cdk-lib'
import * as sm from 'aws-cdk-lib/aws-secretsmanager';

export class SecureCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const catApiKeySecret = new sm.Secret(this, 'CatApiKey', {
      secretName: 'cat-api-key'
    });
    const qdrantApiKeySecret = new sm.Secret(this, 'QdrantApiKey', {
      secretName: 'qdrant-api-key'
    });

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
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

const app = new cdk.App();
new SecureCat(app, 'secure');

```

In this example, the api key values will be automatically generated by cdk at the first deployment and will be inserted into the AWS Secrets.

![1705925803352](image/README/1705925803352.png)

If you want to set a custom values for the api keys you can create manually the AWS Secrets and then import it in the cdk stack

```typescript
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as cdk from 'aws-cdk-lib'
import * as sm from 'aws-cdk-lib/aws-secretsmanager';

export class SecureCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const catApiKeySecret = sm.Secret.fromSecretCompleteArn(this, 'CatApiKey', "arn:aws:secretsmanager:<Region>:<AccountId>:secret:SecretName-6RandomCharacters");
    const qdrantApiKeySecret = sm.Secret.fromSecretCompleteArn(this, 'QdrantApiKey', "arn:aws:secretsmanager:<Region>:<AccountId>:secret:SecretName-6RandomCharacters");

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
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

const app = new cdk.App();
new SecureCat(app, 'secure');
```

### Domain Cat

To run a Cheshire Cat under a custom domain to have SSL protection, you can implement the following example.

To set up this example, keep these considerations in mind:

- The domain specified in the cat configuration must be hosted on Route 53
- You must specify in the cdk stack instance the id of the deployment destination account and the region where the domain certificate is also located

```typescript
import * as cdk from 'aws-cdk-lib';
import { DomainCat } from './stack';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';

export class DomainCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      domainProps: {
        catDomainProps: {
          domainName: 'example.com',
          subDomain: 'cat'
        },
        qdrantDomainProps: {
          domainName: 'example.com',
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

const app = new cdk.App();
new DomainCat(app, 'domain-cat', { env: { account: '000000000000', region: 'eu-central-1' } });
```

if you want to use a domain not hosted in route53 you will have to manually [create the certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html) and import it into the stack in this way:

```typescript
import * as cdk from 'aws-cdk-lib';
import { DomainCat } from './stack';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as cm from 'aws-cdk-lib/aws-certificatemanager'

export class DomainCat extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainCert = cm.Certificate.fromCertificateArn(this, 'Certificate', 'arn:aws:acm:region:account:certificate/certificate_ID');

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      domainProps: {
        catDomainProps: {
          certificate: domainCert,
          domainName: 'lucapirrone.com',
          subDomain: 'cat'
        },
        qdrantDomainProps: {
          certificate: domainCert,
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

const app = new cdk.App();
new DomainCat(app, 'domain-cat', { env: { account: '000000000000', region: 'eu-central-1' } });

```

See these example CDK apps [here](./examples).

## Way of Work

### Release once and install plugins manually

By default the EFS is mounted in the folder containing the cat's plugins in order to make them persistent. If you want to manually load the plugins from the cat's admin panel, just release CdkCheshireCat with the default configuration:

```ts
import { CfnOutput, Stack, StackProps, App } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';

export class DefaultCat extends Stack {
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
new DefaultCat(app, 'default');
```

![Upload plugin admin](image/README/upload-plugin-admin.png)

The plugins will be persisted even if the cluster service tasks are restarted.

### Keep plugins in the codebase

If you want to keep your plugins within your codebase and deploy them along with the cat then you can use this setup:

> **CAUTION**
> Plugins loaded manually from the cat's admin panel WILL NOT BE PERSISTED.

```typescript
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkCheshireCat } from 'cdk-cheshire-cat';
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as cdk from 'aws-cdk-lib'
import * as path from 'path'

export class CustomCatImage extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
  
    const qdrantImage = ecs.ContainerImage.fromRegistry('qdrant/qdrant:v1.7.2');
    // You have to link the Dockerfile folder, for example ./core with local custom plugins installed
    const catImage = ecs.ContainerImage.fromAsset(path.resolve(__dirname, 'core'));

    const cheshireCat = new CdkCheshireCat(this, 'CheshireCat', {
      customQdrantContainerImage: qdrantImage,
      customCatContainerImage: catImage
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

const app = new cdk.App();
new CustomCatImage(app, 'custom-cat-image');
```

After deployment you will have to manually enable the plugins from the cat admin panel:

![Upload plugin admin](image/README/enable-plugin-admin.png)

The plugin will be persisted even if the cluster service tasks are restarted.
However, plugins loaded manually from the cat's admin panel WILL NOT BE PERSISTED.
