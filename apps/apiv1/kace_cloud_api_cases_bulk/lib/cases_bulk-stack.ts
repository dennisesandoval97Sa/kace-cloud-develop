import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class CasesBulkStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'cases-bulk';
        const lambdaFunction = this.getNodejsFunction(path);
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(id, lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);

        const transitionResource = lambdaRestApi.root.addResource('transition');
        transitionResource.addMethod('POST', undefined, methodOptions);

        const closeResource = lambdaRestApi.root.addResource('close');
        closeResource.addMethod('POST', undefined, methodOptions);

        const assignResource = lambdaRestApi.root.addResource('assign');
        assignResource.addMethod('POST', undefined, methodOptions);
    }
}
