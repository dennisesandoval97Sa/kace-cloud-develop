import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TARGET_DYNAMODB_TABLE;
const READER_HOST = process.env.DB_HOST_READER;
const REGION = process.env.TARGET_DYNAMODB_REGION ?? 'us-east-1';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export const backfill = async () => {
    if (!TABLE || !READER_HOST) {
        throw new Error('TARGET_DYNAMODB_TABLE and DB_HOST_READER are required');
    }
    let ExclusiveStartKey;
    let updated = 0;
    const failed = [];
    do {
        const page = await client.send(
            new ScanCommand({
                TableName: TABLE,
                ExclusiveStartKey,
                Limit: 50,
                ProjectionExpression: 'id, db_host_reader',
            })
        );
        for (const item of page.Items ?? []) {
            if (item.db_host_reader) {
                continue;
            }
            try {
                await client.send(
                    new UpdateCommand({
                        TableName: TABLE,
                        Key: { id: item.id },
                        UpdateExpression: 'SET db_host_reader = :h',
                        ExpressionAttributeValues: { ':h': READER_HOST },
                    })
                );
                updated += 1;
            } catch (err) {
                failed.push({ id: item.id, error: err?.message ?? String(err) });
            }
        }
        ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return { updated, failed };
};
