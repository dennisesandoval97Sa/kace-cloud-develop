import { v4 as uuid } from 'uuid';
import { KnexAutomatedAssignmentRunsRepository } from '../../src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js';
import { AutomatedAssignmentRun } from '../../src/automated-assignment-runs/domain/AutomatedAssignmentRun.js';
import { AutomatedAssignmentRunSearcher } from '../../src/automated-assignment-runs/application/search/AutomatedAssignmentRunSearcher.js';
import { AutomatedAssignmentRunFinder } from '../../src/automated-assignment-runs/application/find/AutomatedAssignmentRunFinder.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

function runDto(override = {}) {
    return {
        id: uuid(),
        started_at: new Date(),
        finished_at: new Date(),
        duration_ms: 900,
        status: 'completed',
        actions_evaluated: 1,
        candidates_total: 5,
        candidates_backlog_total: 8575,
        assigned: 2,
        skipped: 0,
        errors: 0,
        groups_without_capacity: 0,
        actions_detail: { actions: [], prefilter: null },
        capacity_snapshot: { groups: [] },
        error_detail: null,
        ...override,
    };
}

describe('AutomatedAssignmentRunSearcher + Finder', () => {
    const knex = knexConfig;
    const repo = new KnexAutomatedAssignmentRunsRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`TRUNCATE TABLE ${schema}.automated_assignment_runs CASCADE`);
    });

    it('search returns items + count, without jsonb detail in items', async () => {
        await repo.save(AutomatedAssignmentRun.create(runDto()));
        await repo.save(AutomatedAssignmentRun.create(runDto({ status: 'no_actions' })));

        const searcher = new AutomatedAssignmentRunSearcher(repo);
        const response = await searcher.execute({
            filter: [
                {
                    field: 'automated_assignment_runs.status',
                    operator: 'eq',
                    value: 'completed',
                    type: 'and',
                },
            ],
            relationship: null,
            limit: 10,
            offset: 0,
            order: null,
        });

        const json = response.toJson();
        expect(json.metadata.count).toBe(1);
        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].status).toBe('completed');
        expect(json.data.items[0].candidates_backlog_total).toBe(8575);
        expect(new Date(json.data.items[0].created_at).getTime()).not.toBeNaN();
        expect(json.data.items[0]).not.toHaveProperty('actions_detail');
        expect(json.data.items[0]).not.toHaveProperty('capacity_snapshot');
    });

    it('finder returns the full run including jsonb detail', async () => {
        const dto = runDto({
            actions_detail: { actions: [{ id: 'a1', assigned: 2 }], prefilter: null },
        });
        await repo.save(AutomatedAssignmentRun.create(dto));

        const finder = new AutomatedAssignmentRunFinder(repo);
        const response = await finder.execute(dto.id);

        const json = response.toJson();
        expect(json.data.id).toBe(dto.id);
        expect(json.data.actions_detail.actions).toHaveLength(1);
        expect(json.data.capacity_snapshot).toEqual({ groups: [] });
    });

    it('finder throws ValidationFailError 404 for unknown id', async () => {
        const finder = new AutomatedAssignmentRunFinder(repo);
        await expect(finder.execute(uuid())).rejects.toThrow(ValidationFailError);
    });

    it('finder enriches capacity snapshot groups and available users with their current name', async () => {
        const seededGroupId = '3824c61a-6368-4c5c-957f-769525109e85'; // globalGroupId del seed (Administrators Group)
        const seededUserId = '8a09ba2c-0231-4cc3-b02d-5b90054d6f90'; // globalUserId del seed (Roberto García)
        const unknownGroupId = uuid();
        const unknownUserId = uuid();
        const dto = runDto({
            capacity_snapshot: {
                groups: [
                    {
                        grupo_id: seededGroupId,
                        users_with_capacity: 1,
                        capacidad: 8,
                        assigned: 0,
                        available_users: [
                            { usuario_id: seededUserId, with_capacity: true },
                            { usuario_id: unknownUserId, with_capacity: false },
                        ],
                    },
                    { grupo_id: unknownGroupId, users_with_capacity: 0, capacidad: 0, assigned: 0 },
                ],
            },
        });
        await repo.save(AutomatedAssignmentRun.create(dto));

        const finder = new AutomatedAssignmentRunFinder(repo);
        const json = (await finder.execute(dto.id)).toJson();

        const groups = json.data.capacity_snapshot.groups;
        const seededGroup = groups.find((group) => group.grupo_id === seededGroupId);
        expect(seededGroup.nombre).toBe('Administrators Group');
        expect(groups.find((group) => group.grupo_id === unknownGroupId).nombre).toBeNull();

        expect(seededGroup.available_users.find((user) => user.usuario_id === seededUserId).nombre).toBe(
            'Roberto García'
        );
        expect(seededGroup.available_users.find((user) => user.usuario_id === unknownUserId).nombre).toBeNull();
    });

    it('excludes soft-deleted runs from search, count and finder', async () => {
        const dto = runDto();
        await repo.save(AutomatedAssignmentRun.create(dto));
        await knex.raw(`UPDATE ${schema}.automated_assignment_runs SET deleted_at = now() WHERE id = ?`, [dto.id]);

        const searcher = new AutomatedAssignmentRunSearcher(repo);
        const response = await searcher.execute({
            filter: [],
            relationship: null,
            limit: 10,
            offset: 0,
            order: null,
        });
        const json = response.toJson();
        expect(json.data.items).toHaveLength(0);
        expect(json.metadata.count).toBe(0);

        const finder = new AutomatedAssignmentRunFinder(repo);
        await expect(finder.execute(dto.id)).rejects.toThrow(ValidationFailError);
    });
});
