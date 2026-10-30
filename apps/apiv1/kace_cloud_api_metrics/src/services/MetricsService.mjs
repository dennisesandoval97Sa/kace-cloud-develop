import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import Joi from 'joi';

const METRIC_SCHEMA = Joi.object({
    name: Joi.string().valid('LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP').required(),
    value: Joi.number().min(0).required(),
    rating: Joi.string().valid('good', 'needs-improvement', 'poor').required(),
    delta: Joi.number().min(0).optional(),
    url: Joi.string().max(500).required(),
    sessionId: Joi.string().uuid().required(),
    appVersion: Joi.string().max(20).required(),
    connectionType: Joi.string().max(20).default('unknown'),
    navigationType: Joi.string().max(30).optional(),
    userAgent: Joi.string().optional(),
    timestamp: Joi.string().isoDate().required(),
});

const DYNAMO_BATCH_LIMIT = 25;

export class MetricsService {
    #docClient;
    #tableName;
    #ttlDays;

    constructor(docClient, tableName, ttlDays = 90) {
        this.#docClient = docClient;
        this.#tableName = tableName;
        this.#ttlDays = ttlDays;
    }

    async batchWrite(metrics) {
        const validMetrics = metrics
            .map((m) => {
                const { error, value } = METRIC_SCHEMA.validate(m, { stripUnknown: true });
                return error ? null : value;
            })
            .filter(Boolean);

        if (validMetrics.length === 0) return 0;

        const chunks = this.#chunk(validMetrics, DYNAMO_BATCH_LIMIT);
        let writtenCount = 0;

        for (const chunk of chunks) {
            const items = chunk.map((metric) => ({
                PutRequest: {
                    Item: {
                        date: metric.timestamp.slice(0, 10),
                        timestamp: `${metric.timestamp}#${randomUUID()}`,
                        name: metric.name,
                        value: metric.value,
                        rating: metric.rating,
                        delta: metric.delta,
                        url: metric.url,
                        sessionId: metric.sessionId,
                        appVersion: metric.appVersion,
                        connectionType: metric.connectionType,
                        navigationType: metric.navigationType,
                        userAgent: (metric.userAgent || '').slice(0, 256),
                        ttl: Math.floor(Date.now() / 1000) + this.#ttlDays * 24 * 60 * 60,
                    },
                },
            }));

            try {
                await this.#docClient.send(
                    new BatchWriteCommand({
                        RequestItems: { [this.#tableName]: items },
                    })
                );
                writtenCount += chunk.length;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('DynamoDB BatchWrite error:', error);
            }
        }

        return writtenCount;
    }

    #chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}
