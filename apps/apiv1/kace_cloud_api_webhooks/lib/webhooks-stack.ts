import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';
import { ApiKey, LambdaRestApi, MethodOptions, Period, UsagePlan } from 'aws-cdk-lib/aws-apigateway';

export class WebhooksStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'webhooks';

        this.config.enableAuth = false;

        const lambdaFunction = this.getNodejsFunction(path);

        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);

        const apiKeyMethodOptions: MethodOptions = {
            apiKeyRequired: true,
        };

        this.addWebhookResource(lambdaRestApi, 'channel-hub', apiKeyMethodOptions);

        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);

        const channelHubKey = new ApiKey(this, 'ChannelHubApiKey', {
            apiKeyName: `${kProps.appsServiceName}-webhooks-channel-hub`,
            description: 'API Key for Channel Hub webhook integrations',
            enabled: true,
        });

        const usagePlan = new UsagePlan(this, 'WebhooksUsagePlan', {
            name: `${kProps.appsServiceName}-webhooks-usage-plan`,
            description: 'Usage plan for inbound webhooks',
            throttle: {
                rateLimit: 50,
                burstLimit: 100,
            },
            quota: {
                limit: 100000,
                period: Period.DAY,
            },
            apiStages: [
                {
                    api: lambdaRestApi,
                    stage: lambdaRestApi.deploymentStage,
                },
            ],
        });

        usagePlan.addApiKey(channelHubKey);
    }

    private addWebhookResource(lambdaRestApi: LambdaRestApi, sourceName: string, methodOptions: MethodOptions) {
        const resource = lambdaRestApi.root.addResource(sourceName);
        resource.addMethod('POST', undefined, methodOptions);
    }
}
