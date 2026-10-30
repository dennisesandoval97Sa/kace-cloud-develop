import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';

/**
 * Normalizes incoming events from SQS or EventBridge into a uniform array
 * of records, each with a `body` (stringified DomainEvent JSON) and a
 * `messageId`.
 *
 * @param {Object} event - Raw Lambda event
 * @returns {Array<{body: string, messageId: string}>}
 */
export function normalizeToRecords(event) {
    if (event.Records) {
        return event.Records;
    }
    if (event['detail-type'] && event.detail) {
        return [
            {
                body: JSON.stringify(event.detail),
                messageId: event.id || `eb-${Date.now()}`,
            },
        ];
    }
    Helper.logError('normalizeToRecords: unknown event format', { keys: Object.keys(event) });
    return [];
}
