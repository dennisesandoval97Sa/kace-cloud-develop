import { computeTargetPartition, buildCreatePartitionSql } from '../src/partition-naming.mjs';

describe('computeTargetPartition', () => {
    it('returns next-next month for a date in the middle of a month', () => {
        const result = computeTargetPartition(new Date(Date.UTC(2026, 4, 11)), 'ws_rest_flow_executions');
        expect(result.name).toBe('ws_rest_flow_executions_2026_07');
        expect(result.fromDate).toBe('2026-07-01');
        expect(result.toDate).toBe('2026-08-01');
    });

    it('handles year rollover when current month is November', () => {
        const result = computeTargetPartition(new Date(Date.UTC(2026, 10, 5)), 'ws_rest_flow_executions');
        expect(result.name).toBe('ws_rest_flow_executions_2027_01');
        expect(result.fromDate).toBe('2027-01-01');
        expect(result.toDate).toBe('2027-02-01');
    });

    it('handles year rollover when current month is December', () => {
        const result = computeTargetPartition(new Date(Date.UTC(2026, 11, 31)), 'ws_rest_flow_executions');
        expect(result.name).toBe('ws_rest_flow_executions_2027_02');
        expect(result.fromDate).toBe('2027-02-01');
        expect(result.toDate).toBe('2027-03-01');
    });

    it('pads single-digit months with leading zero in the partition name', () => {
        const result = computeTargetPartition(new Date(Date.UTC(2026, 0, 15)), 'ws_rest_flow_executions');
        expect(result.name).toBe('ws_rest_flow_executions_2026_03');
        expect(result.fromDate).toBe('2026-03-01');
    });

    it('uses the tableName argument for the partition name prefix', () => {
        const result = computeTargetPartition(new Date(Date.UTC(2026, 4, 11)), 'event_logs');
        expect(result.name).toBe('event_logs_2026_07');
        expect(result.fromDate).toBe('2026-07-01');
        expect(result.toDate).toBe('2026-08-01');
    });

    it('works with all expected managed tables', () => {
        const date = new Date(Date.UTC(2026, 4, 11));
        expect(computeTargetPartition(date, 'history_cases').name).toBe('history_cases_2026_07');
        expect(computeTargetPartition(date, 'history_usuarios').name).toBe('history_usuarios_2026_07');
        expect(computeTargetPartition(date, 'history_aux_cases').name).toBe('history_aux_cases_2026_07');
    });
});

describe('buildCreatePartitionSql', () => {
    it('emits IF NOT EXISTS so re-runs are idempotent', () => {
        const sql = buildCreatePartitionSql(
            {
                name: 'ws_rest_flow_executions_2026_07',
                fromDate: '2026-07-01',
                toDate: '2026-08-01',
            },
            'ws_rest_flow_executions'
        );
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS ws_rest_flow_executions_2026_07');
        expect(sql).toContain('PARTITION OF ws_rest_flow_executions');
        expect(sql).toContain("FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')");
    });

    it('uses the tableName argument in PARTITION OF clause', () => {
        const sql = buildCreatePartitionSql(
            {
                name: 'event_logs_2026_07',
                fromDate: '2026-07-01',
                toDate: '2026-08-01',
            },
            'event_logs'
        );
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_logs_2026_07');
        expect(sql).toContain('PARTITION OF event_logs');
    });
});
