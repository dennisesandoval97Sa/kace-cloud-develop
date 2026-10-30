import { KnexAutomatedAssignmentBacklogSnapshotsRepository } from '../../src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentBacklogSnapshotsRepository.js';
import { knexConfig } from '../knexfile.js';

describe('KnexAutomatedAssignmentBacklogSnapshotsRepository', () => {
    const knex = knexConfig;
    const repo = new KnexAutomatedAssignmentBacklogSnapshotsRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`TRUNCATE TABLE ${schema}.automated_assignment_backlog_snapshots`);
    });

    it('upsert inserts and then overwrites the same action', async () => {
        await repo.upsert({
            action_id: 'a1',
            backlog: 10,
            computed_at: new Date('2026-10-15T10:00:00Z'),
            duration_ms: 5,
        });
        await repo.upsert({
            action_id: 'a1',
            backlog: 11224,
            computed_at: new Date('2026-10-15T10:05:00Z'),
            duration_ms: 37900,
        });

        const rows = await knex(`${schema}.automated_assignment_backlog_snapshots`).select('*');
        expect(rows).toHaveLength(1);
        expect(rows[0].backlog).toBe(11224);
        expect(rows[0].duration_ms).toBe(37900);
        expect(new Date(rows[0].computed_at).toISOString()).toBe('2026-10-15T10:05:00.000Z');
        expect(new Date(rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(new Date(rows[0].created_at).getTime());
    });

    it('upsert keeps the original created_at when overwriting', async () => {
        await repo.upsert({ action_id: 'a1', backlog: 1, computed_at: new Date(), duration_ms: 1 });
        const [first] = await knex(`${schema}.automated_assignment_backlog_snapshots`).select('created_at');

        await repo.upsert({ action_id: 'a1', backlog: 2, computed_at: new Date(), duration_ms: 1 });
        const [second] = await knex(`${schema}.automated_assignment_backlog_snapshots`).select('created_at');

        expect(new Date(second.created_at).getTime()).toBe(new Date(first.created_at).getTime());
    });

    it('findByActionIds returns backlog and ISO computed_at only for known ids', async () => {
        await repo.upsert({
            action_id: 'a1',
            backlog: 2163,
            computed_at: new Date('2026-10-15T10:07:00Z'),
            duration_ms: 1,
        });

        const map = await repo.findByActionIds(['a1', 'unknown']);

        expect(map.size).toBe(1);
        expect(map.get('a1')).toEqual({ backlog: 2163, computed_at: '2026-10-15T10:07:00.000Z' });
    });

    it('findByActionIds with no ids returns an empty map', async () => {
        await expect(repo.findByActionIds([])).resolves.toEqual(new Map());
    });

    it('deleteNotIn keeps listed actions and removes the rest', async () => {
        const computed_at = new Date();
        await repo.upsert({ action_id: 'a1', backlog: 1, computed_at, duration_ms: 1 });
        await repo.upsert({ action_id: 'a2', backlog: 2, computed_at, duration_ms: 1 });

        const removed = await repo.deleteNotIn(['a1']);

        expect(removed).toBe(1);
        expect([...(await repo.findByActionIds(['a1', 'a2'])).keys()]).toEqual(['a1']);
    });

    it('deleteNotIn with an empty list removes every row', async () => {
        await repo.upsert({ action_id: 'a1', backlog: 1, computed_at: new Date(), duration_ms: 1 });

        await expect(repo.deleteNotIn([])).resolves.toBe(1);
    });
});
