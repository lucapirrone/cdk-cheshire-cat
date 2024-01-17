#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SimpleCat } from './stack';

const app = new cdk.App();
new SimpleCat(app, 'simple');
