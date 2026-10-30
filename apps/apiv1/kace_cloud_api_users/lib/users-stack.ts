import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';
import { StackProps } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

export class UsersStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'users';
        const lambdaFunction = this.getNodejsFunction(path);
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(path));

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const methodOptions = this.getLambdaRestApiMethodOptions();

        // Default resources except advance-search: BaseController answers it with raw `usuarios` rows,
        // session and Cognito token columns included, and no client uses it.
        this.setIndexResource(lambdaRestApi, methodOptions);
        this.setCreateResource(lambdaRestApi, methodOptions);
        this.setReadResource(lambdaRestApi, methodOptions);
        this.setUpdateResource(lambdaRestApi, methodOptions);
        this.setDeleteResource(lambdaRestApi, methodOptions);
        this.setSearchResource(lambdaRestApi, methodOptions);
        this.setHistoryResource(lambdaRestApi, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const integrationActivityResource = idResource.addResource('integration-activity');
        integrationActivityResource.addMethod('POST', undefined, methodOptions);

        const userResoruce = lambdaRestApi.root;

        const searchByNameResource = userResoruce.addResource('searchByName');
        searchByNameResource.addMethod('POST', undefined, methodOptions);

        // `/session` only groups its children: no controller handles a request to it.
        const sessionResource = userResoruce.addResource('session');

        const userIdResource = sessionResource.addResource('alive');
        userIdResource.addMethod('POST', undefined, methodOptions);

        const validateGroupResource = sessionResource.addResource('validate-group');
        validateGroupResource.addMethod('GET', undefined, methodOptions);

        const updateActiveGroupResource = userResoruce.addResource('update-active-group');
        updateActiveGroupResource.addMethod('POST', undefined, methodOptions);

        const bulkUpdateResource = userResoruce.addResource('bulk-update');
        bulkUpdateResource.addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
    }

    nodejsFunctionDefaultProps(): NodejsFunctionProps {
        const props = super.nodejsFunctionDefaultProps();
        return {
            ...props,
            memorySize: 512,
        };
    }
}
