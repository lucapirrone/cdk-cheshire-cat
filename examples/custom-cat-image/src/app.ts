#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CustomCatImage } from './stack';

const app = new cdk.App();
new CustomCatImage(app, 'custom-cat-image');
