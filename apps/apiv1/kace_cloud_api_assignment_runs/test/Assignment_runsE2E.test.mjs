import { TestHelper } from '@kace/api-common';
import { KnexAutomatedAssignmentRunsRepository } from '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js';
import { AutomatedAssignmentRun } from '@kace/core/src/automated-assignment-runs/domain/AutomatedAssignmentRun.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('assignment-runs E2E test', () => {
    const validDto = {
        id: uuidv4(),
        started_at: new Date(),
        finished_at: new Date(),
        duration_ms: 1200,
        status: 'completed',
        actions_evaluated: 1,
        candidates_total: 10,
        assigned: 4,
        skipped: 1,
        errors: 0,
        groups_without_capacity: 0,
        actions_detail: { actions: [], prefilter: null },
        capacity_snapshot: { groups: [] },
        error_detail: null,
    };

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/assignment-runs`
            : 'http://localhost:60102';

    it('reads a persisted run by id', async () => {
        const repository = new KnexAutomatedAssignmentRunsRepository(knexConfig);
        await repository.save(AutomatedAssignmentRun.create(validDto));

        const response = await TestHelper.getRequest(`${baseUrl}/${validDto.id}`);

        expect(response).toHaveProperty('status', 200);
        expect(response.data.data).toHaveProperty('status', 'completed');
    });

    it('returns statusCode 400 when id is invalid', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/invalid_id`);
        expect(response).toHaveProperty('status', 400);
    });

    it('returns statusCode 404 for a well-formed id that does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);
        expect(response).toHaveProperty('status', 404);
    });

    it('searches runs with pagination', async () => {
        const response = await TestHelper.postRequest(`${baseUrl}/search`, {
            filter: null,
            limit: 10,
            offset: 0,
            order: null,
        });

        expect(response).toHaveProperty('status', 200);
        expect(Array.isArray(response.data.data.items)).toBe(true);
    });
});
