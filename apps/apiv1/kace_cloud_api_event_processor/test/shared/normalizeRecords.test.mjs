import { normalizeToRecords } from '../../src/shared/normalizeRecords.mjs';

describe('normalizeToRecords', () => {
    it('returns Records[] unchanged when event has SQS format', () => {
        const event = { Records: [{ body: '{}', messageId: 'm-1' }] };
        expect(normalizeToRecords(event)).toEqual([{ body: '{}', messageId: 'm-1' }]);
    });

    it('wraps EventBridge event into a single-element array', () => {
        const event = {
            'detail-type': 'kace.core.case.created',
            detail: { eventName: 'kace.core.case.created', aggregateId: 'a' },
            id: 'eb-id-1',
        };
        const result = normalizeToRecords(event);
        expect(result).toHaveLength(1);
        expect(result[0].messageId).toBe('eb-id-1');
        expect(JSON.parse(result[0].body)).toEqual(event.detail);
    });

    it('generates a synthetic messageId when EventBridge event has no id', () => {
        const event = {
            'detail-type': 'kace.core.case.created',
            detail: { eventName: 'x' },
        };
        const result = normalizeToRecords(event);
        expect(result[0].messageId).toMatch(/^eb-/);
    });

    it('returns [] for unknown format', () => {
        const result = normalizeToRecords({ foo: 'bar' });
        expect(result).toEqual([]);
    });
});
