import { Duration, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class WsHookRestFlowsStack extends KApiStack {
    static readonly LAMBDA_SECONDS_TIMEOUT = 600;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const lambdaFunction = this.getNodejsFunction('ws-hook-rest-flows');
        const lambdaRestApi = this.getLambdaRestApi('ws-hook-rest-flows', lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);

        // Custom route: GET /executions/{id} for checking async execution status
        const executionsResource = lambdaRestApi.root.addResource('executions');
        const executionIdResource = executionsResource.addResource('{id}');
        executionIdResource.addMethod('GET', undefined, methodOptions);

        this.setBasePath('ws-hook-rest-flows', lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions('ws-hook-rest-flows', lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);
    }

    nodejsFunctionDefaultProps() {
        const baseProps = super.nodejsFunctionDefaultProps();
        return {
            ...baseProps,
            timeout: Duration.seconds(WsHookRestFlowsStack.LAMBDA_SECONDS_TIMEOUT),
        };
    }
}
