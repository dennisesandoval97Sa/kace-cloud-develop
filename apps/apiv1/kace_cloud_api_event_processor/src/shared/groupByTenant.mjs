import { DomainEvent } from '@kace/core/src/shared/domain/events/DomainEvent.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';

/**
 * Groups normalized records by tenant_id. Records with missing tenant_id
 * are skipped silently (log debug). Records with invalid JSON are reported
 * via batchItemFailures.
 *
 * @param {Array<{body: string, messageId: string}>} records
 * @param {Array<{itemIdentifier: string}>} batchItemFailures - mutated in-place
 * @returns {Map<string, Array<{record: object, domainEvent: DomainEvent}>>}
 */
export function groupRecordsByTenant(records, batchItemFailures) {
    const grouped = new Map();

    for (const record of records) {
        try {
            const payload = JSON.parse(record.body);
            const domainEvent = DomainEvent.fromJson(payload);
            const tenantId = domainEvent.metadata?.tenant_id;

            if (!tenantId) {
                Helper.logDebug('groupRecordsByTenant: no tenant_id, skipping', {
                    messageId: record.messageId,
                    eventName: domainEvent.eventName,
                });
                continue;
            }

            if (!grouped.has(tenantId)) grouped.set(tenantId, []);
            grouped.get(tenantId).push({ record, domainEvent });
        } catch (error) {
            Helper.logError('groupRecordsByTenant: failed to parse record', {
                messageId: record.messageId,
                error: error.message,
            });
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return grouped;
}
