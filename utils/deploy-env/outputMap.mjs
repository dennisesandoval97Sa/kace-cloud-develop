/**
 * Única fuente de verdad: output de CloudFormation → variable del .env.
 *
 * No mapeados a propósito (ningún stack actual los produce o nadie los consume):
 * AWS_SQS_EVENTS_QUEUE_ARN, AWS_SQS_EVENTS_QUEUE_URL, AWS_EVENTBRIDGE_EVENT_BUS_URL y
 * TenantStack.tenantapiEndpoint… (lo genera LambdaRestApi). Ver README.
 *
 * Ojo: AWS_CASE_POST_PROCESSING_QUEUE_URL no lleva EVENTS, igual que en .env.example.
 */
export const OUTPUT_MAP = Object.freeze({
    AwsInfraStack: {
        OutputAPIDomainName: 'AWS_APIGATEWAY_DOMAIN_NAME',
        OutputDomainNameAliasTarget: 'AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_TARGET',
        OutputDomainNameAliasHostedZoneId: 'AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_HOSTED_ZONE_ID',
    },
    TenantStack: {
        OutputTableArn: 'AWS_DYNAMODB_MULTITENANT_TABLE_ARN',
    },
    EventProcessorStack: {
        EventBusArn: 'AWS_EVENTBRIDGE_EVENT_BUS_ARN',
        CasesEventsQueueArn: 'AWS_CASES_EVENTS_QUEUE_ARN',
        CasesEventsQueueUrl: 'AWS_CASES_EVENTS_QUEUE_URL',
        ActionJobsEventsQueueArn: 'AWS_ACTION_JOBS_EVENTS_QUEUE_ARN',
        ActionJobsEventsQueueUrl: 'AWS_ACTION_JOBS_EVENTS_QUEUE_URL',
        AutomatedActionsEventsQueueArn: 'AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN',
        AutomatedActionsEventsQueueUrl: 'AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_URL',
        WSRestEventsQueueArn: 'AWS_WS_REST_EVENTS_QUEUE_ARN',
        WSRestEventsQueueUrl: 'AWS_WS_REST_EVENTS_QUEUE_URL',
        CasePostProcessingEventsQueueArn: 'AWS_CASE_POST_PROCESSING_EVENTS_QUEUE_ARN',
        CasePostProcessingEventsQueueUrl: 'AWS_CASE_POST_PROCESSING_QUEUE_URL',
        ReportsEventsQueueArn: 'AWS_REPORTS_EVENTS_QUEUE_ARN',
        ReportsEventsQueueUrl: 'AWS_REPORTS_EVENTS_QUEUE_URL',
        ImportsEventsQueueArn: 'AWS_IMPORTS_EVENTS_QUEUE_ARN',
        ImportsEventsQueueUrl: 'AWS_IMPORTS_EVENTS_QUEUE_URL',
    },
});

export const DERIVED_ENV_KEYS = Object.freeze(Object.values(OUTPUT_MAP).flatMap((outputs) => Object.values(outputs)));

export function stackName(serviceName, stackId) {
    return `${serviceName}${stackId}`;
}

export function mapOutputs(stackId, outputs = []) {
    const expected = OUTPUT_MAP[stackId];
    if (!expected) {
        throw new Error(`Stack sin mapa de outputs: ${stackId}`);
    }
    const byKey = new Map(outputs.map((output) => [output.OutputKey, output.OutputValue]));
    const updates = {};
    const missing = [];
    for (const [outputKey, envKey] of Object.entries(expected)) {
        const value = byKey.get(outputKey);
        if (value) {
            updates[envKey] = value;
        } else {
            missing.push(outputKey);
        }
    }
    return { updates, missing };
}
