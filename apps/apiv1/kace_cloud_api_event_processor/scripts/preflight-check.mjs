#!/usr/bin/env node
/* eslint-disable no-console */

import { SQSClient, GetQueueUrlCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { CloudFormationClient, ListExportsCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'us-east-1';
const SVC = process.env.APPS_SERVICE_NAME || 'DEVELOPMENT';

const sqsClient = new SQSClient({ region: REGION });
const cfnClient = new CloudFormationClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });

const results = [];
const fail = (msg) => {
    results.push(['FAIL', msg]);
};
const pass = (msg) => {
    results.push(['PASS', msg]);
};

async function checkOldQueueEmpty() {
    try {
        const { QueueUrl } = await sqsClient.send(
            new GetQueueUrlCommand({
                QueueName: `${SVC}-events-queue.fifo`,
            })
        );
        const { Attributes } = await sqsClient.send(
            new GetQueueAttributesCommand({
                QueueUrl,
                AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
            })
        );
        const visible = parseInt(Attributes.ApproximateNumberOfMessages, 10);
        const invisible = parseInt(Attributes.ApproximateNumberOfMessagesNotVisible, 10);
        if (visible === 0 && invisible === 0) {
            pass(`${SVC}-events-queue.fifo is EMPTY (visible=0 invisible=0)`);
        } else {
            fail(`${SVC}-events-queue.fifo has messages: visible=${visible} invisible=${invisible}`);
        }
    } catch (e) {
        fail(`Could not query ${SVC}-events-queue.fifo: ${e.message}`);
    }
}

async function checkDlqDrained() {
    try {
        const { QueueUrl } = await sqsClient.send(
            new GetQueueUrlCommand({
                QueueName: `${SVC}-events-dlq.fifo`,
            })
        );
        const { Attributes } = await sqsClient.send(
            new GetQueueAttributesCommand({
                QueueUrl,
                AttributeNames: ['ApproximateNumberOfMessages'],
            })
        );
        const count = parseInt(Attributes.ApproximateNumberOfMessages, 10);
        if (count === 0) {
            pass(`${SVC}-events-dlq.fifo is empty`);
        } else {
            fail(`${SVC}-events-dlq.fifo has ${count} messages — triage before cutover`);
        }
    } catch (e) {
        fail(`Could not query ${SVC}-events-dlq.fifo: ${e.message}`);
    }
}

async function checkNoExportNameCollisions() {
    const exports = [];
    let nextToken;
    do {
        const resp = await cfnClient.send(new ListExportsCommand({ NextToken: nextToken }));
        exports.push(...(resp.Exports ?? []));
        nextToken = resp.NextToken;
    } while (nextToken);

    const newExports = [
        `${SVC}-CasesEventsQueueUrl`,
        `${SVC}-ActionJobsEventsQueueUrl`,
        `${SVC}-AutomatedActionsEventsQueueUrl`,
        `${SVC}-WSRestEventsQueueUrl`,
    ];

    const collisions = newExports.filter((name) => exports.some((e) => e.Name === name));
    if (collisions.length === 0) {
        pass('No CloudFormation export-name collisions detected');
    } else {
        fail(`Export collisions: ${collisions.join(', ')}`);
    }
}

async function checkTenantPopulation() {
    const tableName = process.env.MULTITENANCY_TABLE_NAME;
    if (!tableName) {
        fail('MULTITENANCY_TABLE_NAME is not set — set it to verify tenant population (mandatory cutover gate)');
        return;
    }

    const REQUIRED_ATTRS = [
        'aws_cases_events_queue_url',
        'aws_case_post_processing_queue_url',
        'aws_action_jobs_events_queue_url',
        'aws_automated_actions_events_queue_url',
        'aws_ws_rest_events_queue_url',
    ];

    const missingTenantIds = [];
    let exclusiveStartKey;
    do {
        const resp = await dynamoClient.send(
            new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: exclusiveStartKey,
            })
        );
        for (const item of resp.Items ?? []) {
            const tenantId = item.id?.S ?? '(unknown)';
            const hasMissing = REQUIRED_ATTRS.some((attr) => !item[attr]?.S);
            if (hasMissing) {
                missingTenantIds.push(tenantId);
            }
        }
        exclusiveStartKey = resp.LastEvaluatedKey;
    } while (exclusiveStartKey);

    if (missingTenantIds.length === 0) {
        pass(`All tenants in ${tableName} have the 5 required Phase 3 queue URL attributes`);
    } else {
        const examples = missingTenantIds.slice(0, 5).join(', ');
        const more = missingTenantIds.length > 5 ? ` … and ${missingTenantIds.length - 5} more` : '';
        fail(
            `${missingTenantIds.length} tenant(s) in ${tableName} are missing Phase 3 queue URL attributes — run tenant-populate-phase3-urls.mjs first. Examples: ${examples}${more}`
        );
    }
}

async function main() {
    console.log(`Pre-deploy preflight checks for ${SVC} in ${REGION}\n`);
    await checkOldQueueEmpty();
    await checkDlqDrained();
    await checkNoExportNameCollisions();
    await checkTenantPopulation();

    let failed = 0;
    for (const [status, msg] of results) {
        console.log(`  [${status}] ${msg}`);
        if (status === 'FAIL') failed += 1;
    }
    console.log(`\n${results.length} checks, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(2);
});
