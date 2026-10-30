import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { getDbTarget } from '@kace/aws-infra/src/dbRoutingEnv';

export class WorkspaceStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'workspaces';
        const lambdaFunction = this.getNodejsFunction(path);

        // This stack builds the function directly (no setDefaultOptions), so DB_TARGET must be
        // injected by hand from the routing registry (see manual_stacks_db_target_wiring).
        lambdaFunction.addEnvironment('DB_TARGET', getDbTarget('workspaces'));
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const shiftManagementResource = lambdaRestApi.root.getResource('{id}')?.addResource('shift-management');
        shiftManagementResource?.addMethod('GET', undefined, methodOptions);

        const availableResource = lambdaRestApi.root.addResource('available');
        availableResource.addMethod('GET', undefined, methodOptions);

        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        idResource.addResource('deactivate').addMethod('POST', undefined, methodOptions);
        const channelHubTagsResource = idResource.addResource('channel-hub-tags');
        const registerResource = channelHubTagsResource.addResource('register');
        registerResource.addMethod('POST', undefined, methodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);
    }
}
