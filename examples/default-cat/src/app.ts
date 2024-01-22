#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DefaultCat } from './stack';

const app = new cdk.App();
new DefaultCat(app, 'default');
