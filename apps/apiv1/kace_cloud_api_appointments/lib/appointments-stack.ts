import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';

export class AppointmentsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'appointments';
        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand for the read/write split to route reads to the replica.
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}');
        const reSchedulerResource = idResource?.addResource('re-scheduler');
        reSchedulerResource?.addMethod('POST', undefined, methodOptions);

        const byCaseResource = lambdaRestApi.root.addResource('by-case').addResource('count').addResource('{id}');
        byCaseResource.addMethod('get', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }
}
