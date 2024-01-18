#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SecureCat } from './stack';

const app = new cdk.App();
new SecureCat(app, 'secure');
