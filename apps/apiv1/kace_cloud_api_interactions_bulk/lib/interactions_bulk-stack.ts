import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class InteractionsBulkStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'interactions-bulk';
        const lambdaFunction = this.getNodejsFunction(path);
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);

        const moveResource = lambdaRestApi.root.addResource('move');
        moveResource.addMethod('POST', undefined, methodOptions);

        const closeResource = lambdaRestApi.root.addResource('close');
        closeResource.addMethod('POST', undefined, methodOptions);

        const deleteResource = lambdaRestApi.root.addResource('delete');
        deleteResource.addMethod('POST', undefined, methodOptions);

        const agentResource = lambdaRestApi.root.addResource('agent');
        agentResource.addResource('close').addMethod('POST', undefined, methodOptions);
        agentResource.addResource('move').addMethod('POST', undefined, methodOptions);
        agentResource.addResource('{id}').addResource('move-destinations').addMethod('GET', undefined, methodOptions);
    }
}
