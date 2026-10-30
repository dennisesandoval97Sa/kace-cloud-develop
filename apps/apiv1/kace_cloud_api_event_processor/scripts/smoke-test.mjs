#!/usr/bin/env node
/* eslint-disable no-console */

import { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SVC = process.env.APPS_SERVICE_NAME || 'DEVELOPMENT';

const sqsClient = new SQSClient({ region: REGION });
const cwClient = new CloudWatchClient({ region: REGION });

const BCs = ['cases', 'action-jobs', 'automated-actions', 'ws-rest'];

async function queueExists(name) {
    try {
        await sqsClient.send(new GetQueueUrlCommand({ QueueName: name }));
        return true;
    } catch {
        return false;
    }
}

async function queueDepth(name) {
    const { QueueUrl } = await sqsClient.send(new GetQueueUrlCommand({ QueueName: name }));
    const { Attributes } = await sqsClient.send(
        new GetQueueAttributesCommand({
            QueueUrl,
            AttributeNames: ['ApproximateNumberOfMessages'],
        })
    );
    return parseInt(Attributes.ApproximateNumberOfMessages, 10);
}

async function lambdaInvocationsSince(functionName, minutesAgo) {
    const end = new Date();
    const start = new Date(end.getTime() - minutesAgo * 60_000);
    const { Datapoints } = await cwClient.send(
        new GetMetricStatisticsCommand({
            Namespace: 'AWS/Lambda',
            MetricName: 'Invocations',
            Dimensions: [{ Name: 'FunctionName', Value: functionName }],
            StartTime: start,
            EndTime: end,
            Period: 60,
            Statistics: ['Sum'],
        })
    );
    return (Datapoints ?? []).reduce((s, p) => s + (p.Sum ?? 0), 0);
}

async function main() {
    console.log(`Smoke test for ${SVC} in ${REGION}\n`);

    let failed = 0;

    for (const bc of BCs) {
        const main = `${SVC}-${bc}-events-queue.fifo`;
        const dlq = `${SVC}-${bc}-events-dlq.fifo`;

        const mainOk = await queueExists(main);
        const dlqOk = await queueExists(dlq);
        console.log(`  ${mainOk ? '✓' : '✗'} ${main}`);
        console.log(`  ${dlqOk ? '✓' : '✗'} ${dlq}`);

        if (mainOk && dlqOk) {
            const depth = await queueDepth(dlq);
            console.log(`    DLQ depth: ${depth}`);
            if (depth > 0) {
                console.log(`    ⚠ DLQ has ${depth} messages — investigate`);
                failed += 1;
            }
        } else {
            failed += 1;
        }
    }

    console.log('\nLambda invocations (last 5 min):');
    for (const bc of BCs) {
        const expectedPrefix = `${SVC}EventProcessor-eventprocessor${bc}`;
        console.log(`  ${bc}: expected Lambda starting with "${expectedPrefix}" — verify in console`);
    }

    console.log(`\n${failed > 0 ? 'FAILED' : 'PASSED'} (${failed} issues)`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(2);
});
