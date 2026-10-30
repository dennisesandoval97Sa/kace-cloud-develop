import { CasesBulkStack } from '../lib/cases_bulk-stack';
import { config } from 'dotenv';
import path from 'node:path'; // SONAR-EXC: Esta importación es nativa de NODE por lo que no es necesario agregarla como dependencia.
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
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

new CasesBulkStack(app, 'CasesBulkStack', props, kProps); // SONAR-EXC: Esta instancia es necesaria para inicializar recursos en el stack.
