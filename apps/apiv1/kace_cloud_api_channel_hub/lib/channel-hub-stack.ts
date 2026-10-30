import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class ChannelHubStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const lambdaFunction = this.getNodejsFunction('channel-hub');
        const lambdaRestApi = this.getLambdaRestApi('channel-hub', lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        // Add custom POST /{id}/register route
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const registerResource = idResource.addResource('register');
        registerResource.addMethod('POST', undefined, methodOptions);

        const workspacePrioritiesResource = idResource.addResource('workspace-priorities');
        workspacePrioritiesResource.addMethod('GET', undefined, methodOptions);
        workspacePrioritiesResource.addResource('reorder').addMethod('POST', undefined, methodOptions);
        const priorityReordersResource = workspacePrioritiesResource.addResource('reorders');
        priorityReordersResource.addResource('{operationId}').addMethod('GET', undefined, methodOptions);

        this.setBasePath('channel-hub', lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions('channel-hub', lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);
    }
}
