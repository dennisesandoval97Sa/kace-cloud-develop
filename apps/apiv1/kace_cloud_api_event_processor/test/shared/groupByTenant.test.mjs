import { randomUUID } from 'node:crypto';
import { groupRecordsByTenant } from '../../src/shared/groupByTenant.mjs';

function makeRecord(tenantId, messageId = 'm') {
    return {
        body: JSON.stringify({
            eventId: randomUUID(),
            eventName: 'kace.core.case.created',
            aggregateId: randomUUID(),
            occurredOn: new Date().toISOString(),
            payload: {},
            metadata: { tenant_id: tenantId },
        }),
        messageId,
    };
}

describe('groupRecordsByTenant', () => {
    it('groups records by metadata.tenant_id', () => {
        const records = [makeRecord('t-1', 'm-1'), makeRecord('t-2', 'm-2'), makeRecord('t-1', 'm-3')];
        const failures = [];
        const grouped = groupRecordsByTenant(records, failures);

        expect(grouped.get('t-1')).toHaveLength(2);
        expect(grouped.get('t-2')).toHaveLength(1);
        expect(failures).toEqual([]);
    });

    it('skips records without tenant_id (no failure, no group)', () => {
        const recordWithoutTenant = {
            body: JSON.stringify({
                eventId: randomUUID(),
                eventName: 'x',
                aggregateId: randomUUID(),
                occurredOn: new Date().toISOString(),
                payload: {},
                metadata: {},
            }),
            messageId: 'm-skip',
        };
        const failures = [];
        const grouped = groupRecordsByTenant([recordWithoutTenant], failures);

        expect(grouped.size).toBe(0);
        expect(failures).toEqual([]);
    });

    it('records JSON parse failures into batchItemFailures', () => {
        const badRecord = { body: 'not-json{', messageId: 'm-bad' };
        const failures = [];
        const grouped = groupRecordsByTenant([badRecord], failures);

        expect(grouped.size).toBe(0);
        expect(failures).toEqual([{ itemIdentifier: 'm-bad' }]);
    });
});
