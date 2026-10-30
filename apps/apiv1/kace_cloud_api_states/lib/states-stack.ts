import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class StatesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'states';

        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const statesResource = lambdaRestApi.root;

        const listResource = statesResource.addResource('list');
        listResource.addMethod('GET', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 512,
        };
    }
}
