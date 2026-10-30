#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AwsInfraStack } from '../lib/aws_infra-stack';
import { config } from 'dotenv';

config({ path: '../../.env' });

const app = new App();
const props = {
    stack: {
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION,
        },
    },
    domain: process.env.APPS_DOMAIN as string,
    subdomain: process.env.APPS_API_SUBDOMAIN as string,
    serviceName: process.env.APPS_SERVICE_NAME as string,
};

// sonarqube: Esta instancia es necesaria para inicializar recursos en el stack.
new AwsInfraStack(app, 'AwsInfraStack', props);
