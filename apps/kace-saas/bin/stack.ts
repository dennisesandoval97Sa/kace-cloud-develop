#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KaceAdminStack } from '../lib/kace-admin-stack';
import * as dotenv from 'dotenv';

dotenv.config({path: '../.env'});

const app = new cdk.App();

const props: cdk.StackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};
const stackName = `${process.env.APPS_SERVICE_NAME}KaceAdminStack`
try {
    new KaceAdminStack(app, stackName, props);
} catch {
    // SI: Si falla la creación del stack, se detiene el proceso con exit code 1 para evitar un entorno inválido.
    process.exit(1);
}