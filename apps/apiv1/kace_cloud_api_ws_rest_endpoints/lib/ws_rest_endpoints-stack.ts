import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';

export class WsRestEndpointsStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);
        const endpoint = 'ws-rest-endpoints';
        const lambdaFunction = this.getNodejsFunction(endpoint);
        const lambdaRestApi = this.getLambdaRestApi(endpoint, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const tryoutResource = lambdaRestApi.root.getResource('tryout') ?? lambdaRestApi.root.addResource('tryout');
        const idResource = tryoutResource.getResource('{id}') ?? tryoutResource.addResource('{id}');

        idResource.addMethod('GET', undefined, methodOptions);
        this.setBasePath(endpoint, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
    }
}
