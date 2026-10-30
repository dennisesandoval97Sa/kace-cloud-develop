#!/usr/bin/env node
/* eslint-disable no-console */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { derivePerBcUrls } from './tenant-populate-phase3-urls.derive.mjs';

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = process.env.MULTITENANCY_TABLE_NAME;
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!TABLE) {
    console.error('MULTITENANCY_TABLE_NAME env var required.');
    process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });

async function* scanItems() {
    let exclusiveStartKey;
    do {
        const resp = await client.send(
            new ScanCommand({
                TableName: TABLE,
                ExclusiveStartKey: exclusiveStartKey,
            })
        );
        for (const item of resp.Items ?? []) yield item;
        exclusiveStartKey = resp.LastEvaluatedKey;
    } while (exclusiveStartKey);
}

async function main() {
    console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE (will write to DynamoDB)'}`);
    console.log(`Table: ${TABLE}  Region: ${REGION}\n`);
    let scanned = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for await (const item of scanItems()) {
        scanned += 1;
        try {
            const tenantId = item.tenant_id?.S ?? item.id?.S;
            const legacyUrl = item.aws_sqs_events_queue_url?.S;
            if (!legacyUrl) {
                console.log(`  [SKIP] ${tenantId}: no aws_sqs_events_queue_url`);
                skipped += 1;
                continue;
            }

            const urls = derivePerBcUrls(legacyUrl);

            if (DRY_RUN) {
                console.log(`  [DRY-RUN] ${tenantId} → ${JSON.stringify(urls)}`);
                continue;
            }

            // The multitenancy table's partition key is `id` (confirmed in DynamoTenantRepository).
            const Key = { id: item.id };

            await client.send(
                new UpdateItemCommand({
                    TableName: TABLE,
                    Key,
                    UpdateExpression:
                        'SET aws_cases_events_queue_url = :c, aws_case_post_processing_queue_url = :cpp, aws_action_jobs_events_queue_url = :a, aws_automated_actions_events_queue_url = :u, aws_ws_rest_events_queue_url = :w, aws_reports_events_queue_url = :r, aws_imports_events_queue_url = :i',
                    ExpressionAttributeValues: {
                        ':c': { S: urls.cases },
                        ':cpp': { S: urls.case_post_processing },
                        ':a': { S: urls.action_jobs },
                        ':u': { S: urls.automated_actions },
                        ':w': { S: urls.ws_rest },
                        ':r': { S: urls.reports },
                        ':i': { S: urls.imports },
                    },
                })
            );
            console.log(`  [OK] ${tenantId}`);
            updated += 1;
        } catch (e) {
            const failedId = item.tenant_id?.S ?? item.id?.S ?? '(unknown-key)';
            console.error(`  [ERR] ${failedId}: ${e.message}`);
            errors += 1;
        }
    }

    const skippedNote = skipped > 0 ? ' (skipped tenants block cutover — review each)' : '';
    console.log(`\nScanned: ${scanned}, Updated: ${updated}, Skipped: ${skipped}${skippedNote}, Errors: ${errors}`);
    process.exit(errors > 0 || skipped > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(2);
});
