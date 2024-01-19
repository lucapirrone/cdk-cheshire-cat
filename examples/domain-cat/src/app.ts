#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DomainCat } from './stack';

const app = new cdk.App();
new DomainCat(app, 'domain-cat', { env: { account: '826474206466', region: 'eu-central-1' } });
