import { v4 as uuid } from 'uuid';
import { KnexAutomatedAssignmentRunsRepository } from '../../src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js';
import { AutomatedAssignmentRun } from '../../src/automated-assignment-runs/domain/AutomatedAssignmentRun.js';
import { ValueObjectUuid } from '../../src/shared/index.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function runDto(override = {}) {
    const startedAt = new Date();
    return {
        id: uuid(),
        started_at: startedAt,
        finished_at: new Date(startedAt.getTime() + 1500),
        duration_ms: 1500,
        status: 'completed',
        actions_evaluated: 2,
        candidates_total: 40,
        candidates_backlog_total: 8575,
        assigned: 10,
        skipped: 5,
        errors: 0,
        groups_without_capacity: 1,
        actions_detail: { actions: [{ id: 'a1', assigned: 10 }], prefilter: null },
        capacity_snapshot: { groups: [{ grupo_id: 'g1', users_with_capacity: 0, capacidad: 0, assigned: 0 }] },
        error_detail: null,
        ...override,
    };
}

describe('KnexAutomatedAssignmentRunsRepository', () => {
    const knex = knexConfig;
    const repo = new KnexAutomatedAssignmentRunsRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`TRUNCATE TABLE ${schema}.automated_assignment_runs CASCADE`);
    });

    it('save + find roundtrips flat columns and jsonb detail', async () => {
        const dto = runDto();
        await repo.save(AutomatedAssignmentRun.create(dto));

        const found = await repo.find(new ValueObjectUuid('id', dto.id));

        expect(found).not.toBeNull();
        expect(found.id.value).toBe(dto.id);
        expect(found.status.value).toBe('completed');
        expect(found.assigned.value).toBe(10);
        expect(found.candidates_backlog_total.value).toBe(8575);
        expect(found.groups_without_capacity.value).toBe(1);
        expect(found.actions_detail.value).toEqual(dto.actions_detail);
        expect(found.capacity_snapshot.value).toEqual(dto.capacity_snapshot);
        expect(found.error_detail.value).toBeNull();
    });

    it('find returns null for unknown id', async () => {
        const found = await repo.find(new ValueObjectUuid('id', uuid()));
        expect(found).toBeNull();
    });

    it('search filters by started_at range and respects limit/offset', async () => {
        const now = Date.now();
        const oldRun = runDto({ started_at: new Date(now - 3 * DAY_MS) });
        const newRun1 = runDto({ started_at: new Date(now) });
        const newRun2 = runDto({ started_at: new Date(now) });
        const newRun3 = runDto({ started_at: new Date(now) });
        await repo.save(AutomatedAssignmentRun.create(oldRun));
        await repo.save(AutomatedAssignmentRun.create(newRun1));
        await repo.save(AutomatedAssignmentRun.create(newRun2));
        await repo.save(AutomatedAssignmentRun.create(newRun3));

        const filters = [
            {
                field: 'automated_assignment_runs.started_at',
                operator: 'gte',
                value: new Date(now - DAY_MS).toISOString(),
                type: 'and',
            },
        ];
        const criteria = new Criteria(filters, null, 1, 1, null, 'automated_assignment_runs');
        const rows = await repo.search(criteria);

        expect(rows).toHaveLength(1);
        expect([newRun1.id, newRun2.id, newRun3.id]).toContain(rows[0].id.value);
        expect(rows[0].id.value).not.toBe(oldRun.id);
        expect(rows[0].candidates_backlog_total.value).toBe(8575);
    });

    it('count returns total matching rows', async () => {
        await repo.save(AutomatedAssignmentRun.create(runDto()));
        await repo.save(AutomatedAssignmentRun.create(runDto()));

        const criteria = new Criteria(null, null, null, null, null, 'automated_assignment_runs');
        const result = await repo.count(criteria);

        expect(Number(result.count)).toBe(2);
    });

    it('purgeOlderThan deletes only rows older than N days', async () => {
        const now = Date.now();
        const oldRun = runDto({ started_at: new Date(now - 8 * DAY_MS) });
        const freshRun = runDto({ started_at: new Date(now - 2 * DAY_MS) });
        await repo.save(AutomatedAssignmentRun.create(oldRun));
        await repo.save(AutomatedAssignmentRun.create(freshRun));

        const deleted = await repo.purgeOlderThan(7);

        expect(deleted).toBe(1);
        const remaining = await knex(`${schema}.automated_assignment_runs`).select('id');
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe(freshRun.id);
    });
});
