import { config } from 'dotenv';
import path from 'node:path'; // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { ReportsStack } from '../lib/kace_cloud_api_reports-stack';
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

new ReportsStack(app, 'ReportsStack', props, kProps); // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
