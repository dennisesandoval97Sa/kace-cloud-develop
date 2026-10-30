import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';

export class BrokerStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);
        const endpoint = 'broker-mappers';
        const lambdaFunction = this.getNodejsFunction(endpoint);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget('broker-mappers'));
        const lambdaRestApi = this.getLambdaRestApi(endpoint, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const mapperResource = lambdaRestApi.root.getResource('mapper') ?? lambdaRestApi.root.addResource('mapper');
        const idResource = mapperResource.getResource('{id}') ?? mapperResource.addResource('{id}');

        idResource.addMethod('GET', undefined, methodOptions);
        this.setBasePath(endpoint, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
    }
}
