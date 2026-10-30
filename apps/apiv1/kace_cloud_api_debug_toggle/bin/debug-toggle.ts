#!/usr/bin/env node
import { config } from 'dotenv';
import path from 'node:path';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { DebugToggleStack } from '../lib/debug-toggle-stack';
import { App } from 'aws-cdk-lib';

config({ path: '../../../.env' });

const app = new App();
const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};

const kProps: KApiStackProps = {
    ...KApiStack.KProps(),
    pathHandler: path.join(__dirname, '../src/handler.mjs'),
};

new DebugToggleStack(app, 'DebugToggleStack', props, kProps);
