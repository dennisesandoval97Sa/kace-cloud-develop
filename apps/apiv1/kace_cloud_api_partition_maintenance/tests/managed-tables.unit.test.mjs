import { MANAGED_TABLES } from '../src/managed-tables.mjs';

describe('MANAGED_TABLES', () => {
    it('contains every table that the partition_maintenance cron must keep partitioned', () => {
        const names = MANAGED_TABLES.map((t) => t.name);
        expect(names).toEqual(
            expect.arrayContaining([
                'ws_rest_flow_executions',
                'event_logs',
                'history_cases',
                'history_usuarios',
                'history_aux_cases',
            ])
        );
    });

    it('has no duplicate table names', () => {
        const names = MANAGED_TABLES.map((t) => t.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('declares partitionColumn for every entry', () => {
        for (const entry of MANAGED_TABLES) {
            expect(entry).toHaveProperty('name');
            expect(entry).toHaveProperty('partitionColumn');
            expect(typeof entry.name).toBe('string');
            expect(typeof entry.partitionColumn).toBe('string');
        }
    });

    it('uses occurred_at for event_logs and created_at for the others', () => {
        const byName = Object.fromEntries(MANAGED_TABLES.map((t) => [t.name, t.partitionColumn]));
        expect(byName.event_logs).toBe('occurred_at');
        expect(byName.ws_rest_flow_executions).toBe('created_at');
        expect(byName.history_cases).toBe('created_at');
        expect(byName.history_usuarios).toBe('created_at');
        expect(byName.history_aux_cases).toBe('created_at');
    });

    it('rejects any table name that does not match safe identifier regex (defense against SQL injection)', () => {
        const SAFE = /^[a-z][a-z0-9_]*$/;
        for (const entry of MANAGED_TABLES) {
            expect(entry.name).toMatch(SAFE);
        }
    });

    it('is frozen so callers cannot mutate it at runtime', () => {
        expect(Object.isFrozen(MANAGED_TABLES)).toBe(true);
    });
});
