import { StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class ActionBatchExecutionStack extends KApiStack {
    static readonly ENDPOINT = 'action-jobs';
    static readonly LAMBDA_SECONDS_TIMEOUT = 720;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const lambdaFunction = this.getNodejsFunction(ActionBatchExecutionStack.ENDPOINT);
        const lambdaRestApi = this.getLambdaRestApi(ActionBatchExecutionStack.ENDPOINT, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        const validateCsvResource = lambdaRestApi.root.addResource('validate-csv');
        validateCsvResource.addMethod('POST', undefined, methodOptions);
        const processQueueResource = lambdaRestApi.root.addResource('process-queue');
        processQueueResource.addMethod('POST', undefined, methodOptions);
        this.setBasePath(ActionBatchExecutionStack.ENDPOINT, lambdaRestApi);

        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(ActionBatchExecutionStack.ENDPOINT, lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);
    }

    nodejsFunctionDefaultProps() {
        const baseProps = super.nodejsFunctionDefaultProps();
        return {
            ...baseProps,
            timeout: Duration.seconds(ActionBatchExecutionStack.LAMBDA_SECONDS_TIMEOUT),
        };
    }
}
