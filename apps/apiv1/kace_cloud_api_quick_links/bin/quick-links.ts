import { config } from 'dotenv';
import path from 'node:path';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { QuickLinksStack } from '../lib/quick-links-stack';
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

new QuickLinksStack(app, 'QuickLinksStack', props, kProps);
