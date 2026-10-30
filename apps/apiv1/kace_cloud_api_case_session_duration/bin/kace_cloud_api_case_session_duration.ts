import { config } from 'dotenv';
import path from 'node:path';
import { App } from 'aws-cdk-lib';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { CaseSessionDurationStack } from '../lib/kace_cloud_api_case_session_duration-stack';

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

new CaseSessionDurationStack(app, 'CaseSessionDurationStack', props, kProps);
