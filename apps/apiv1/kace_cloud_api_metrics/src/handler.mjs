import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { MetricsService } from './services/MetricsService.mjs';

const MAX_BATCH_SIZE = 50;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const metricsService = new MetricsService(
    docClient,
    process.env.WEB_VITALS_TABLE_NAME,
    parseInt(process.env.TTL_DAYS || '90', 10)
);

export const handler = async (event) => {
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

        if (!body?.metrics || !Array.isArray(body.metrics)) {
            return HttpResponse.badRequest({ event }).toJson();
        }

        if (body.metrics.length === 0) {
            return HttpResponse.badRequest({ event }).toJson();
        }

        const metrics = body.metrics.slice(0, MAX_BATCH_SIZE);
        const acceptedCount = await metricsService.batchWrite(metrics);
        return HttpResponse.accepted({ data: { accepted: acceptedCount }, event }).toJson();
    } catch (error) {
        Helper.logError('MetricsHandler error:', error);

        if (error instanceof SyntaxError) {
            return HttpResponse.badRequest({ event }).toJson();
        }

        return HttpResponse.internalServerError({ errors: error, event }).toJson();
    }
};
