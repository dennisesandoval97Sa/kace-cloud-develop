import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    firstDayOfMonth,
    firstDayOfNextMonth,
    addMonths,
    formatPartitionDate,
    partitionNameForMonth,
    generateMonthlyPartitions,
} from './partition-helpers.js';

describe('firstDayOfMonth', () => {
    it('returns first day at 00:00:00 UTC for a mid-month date', () => {
        const result = firstDayOfMonth(new Date(Date.UTC(2026, 4, 15, 13, 27, 41)));
        assert.equal(result.toISOString(), '2026-05-01T00:00:00.000Z');
    });

    it('is idempotent when input is already first of month', () => {
        const result = firstDayOfMonth(new Date(Date.UTC(2026, 4, 1, 0, 0, 0)));
        assert.equal(result.toISOString(), '2026-05-01T00:00:00.000Z');
    });
});

describe('firstDayOfNextMonth', () => {
    it('returns first of next month UTC', () => {
        const result = firstDayOfNextMonth(new Date(Date.UTC(2026, 4, 15)));
        assert.equal(result.toISOString(), '2026-06-01T00:00:00.000Z');
    });

    it('handles year rollover from December', () => {
        const result = firstDayOfNextMonth(new Date(Date.UTC(2026, 11, 31)));
        assert.equal(result.toISOString(), '2027-01-01T00:00:00.000Z');
    });
});

describe('addMonths', () => {
    it('adds positive months', () => {
        const result = addMonths(new Date(Date.UTC(2026, 4, 1)), 3);
        assert.equal(result.toISOString(), '2026-08-01T00:00:00.000Z');
    });

    it('handles year rollover with positive months', () => {
        const result = addMonths(new Date(Date.UTC(2026, 10, 1)), 5);
        assert.equal(result.toISOString(), '2027-04-01T00:00:00.000Z');
    });

    it('supports n=0 (no-op)', () => {
        const result = addMonths(new Date(Date.UTC(2026, 4, 1)), 0);
        assert.equal(result.toISOString(), '2026-05-01T00:00:00.000Z');
    });

    it('returns first of target month regardless of input day-of-month', () => {
        const result = addMonths(new Date(Date.UTC(2026, 0, 31)), 1);
        assert.equal(result.toISOString(), '2026-02-01T00:00:00.000Z');
    });

    it('supports negative n', () => {
        const result = addMonths(new Date(Date.UTC(2026, 4, 1)), -2);
        assert.equal(result.toISOString(), '2026-03-01T00:00:00.000Z');
    });
});

describe('formatPartitionDate', () => {
    it('formats to YYYY-MM-DD (no time, no zone)', () => {
        assert.equal(formatPartitionDate(new Date(Date.UTC(2026, 4, 1))), '2026-05-01');
    });

    it('pads month and day with leading zero', () => {
        assert.equal(formatPartitionDate(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
    });
});

describe('partitionNameForMonth', () => {
    it('combines tableName with YYYY_MM (zero-padded month)', () => {
        const result = partitionNameForMonth('event_logs', new Date(Date.UTC(2026, 4, 15)));
        assert.equal(result, 'event_logs_2026_05');
    });

    it('handles December correctly', () => {
        const result = partitionNameForMonth('history_cases', new Date(Date.UTC(2026, 11, 1)));
        assert.equal(result, 'history_cases_2026_12');
    });
});

describe('generateMonthlyPartitions', () => {
    it('produces one entry per month in [from, to)', () => {
        const result = generateMonthlyPartitions(
            'event_logs',
            new Date(Date.UTC(2026, 4, 1)),
            new Date(Date.UTC(2026, 7, 1)) // May → Jul (exclusive Aug)
        );
        assert.equal(result.length, 3);
        assert.deepEqual(result[0], {
            name: 'event_logs_2026_05',
            fromDate: '2026-05-01',
            toDate: '2026-06-01',
        });
        assert.deepEqual(result[1], {
            name: 'event_logs_2026_06',
            fromDate: '2026-06-01',
            toDate: '2026-07-01',
        });
        assert.deepEqual(result[2], {
            name: 'event_logs_2026_07',
            fromDate: '2026-07-01',
            toDate: '2026-08-01',
        });
    });

    it('handles year rollover', () => {
        const result = generateMonthlyPartitions(
            'event_logs',
            new Date(Date.UTC(2026, 10, 1)),
            new Date(Date.UTC(2027, 1, 1))
        );
        assert.equal(result.length, 3);
        assert.equal(result[0].name, 'event_logs_2026_11');
        assert.equal(result[1].name, 'event_logs_2026_12');
        assert.equal(result[2].name, 'event_logs_2027_01');
    });

    it('returns empty array when from >= to', () => {
        const result = generateMonthlyPartitions(
            'event_logs',
            new Date(Date.UTC(2026, 4, 1)),
            new Date(Date.UTC(2026, 4, 1))
        );
        assert.deepEqual(result, []);
    });
});
