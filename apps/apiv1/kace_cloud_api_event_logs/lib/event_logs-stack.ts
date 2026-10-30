import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class EventLogsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'event-logs';
        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget('event-logs'));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const eventLogsResource = lambdaRestApi.root;

        const searchByCaseResource = eventLogsResource.addResource('case').addResource('{id}');
        searchByCaseResource.addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 256,
        };
    }
}
