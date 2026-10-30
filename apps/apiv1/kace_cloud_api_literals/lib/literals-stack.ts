import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class LiteralsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'literals';

        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry — otherwise the replica stays silently
        // inactive despite priority:false (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const listResource = idResource.addResource('list');
        listResource.addMethod('GET', undefined, methodOptions);

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
