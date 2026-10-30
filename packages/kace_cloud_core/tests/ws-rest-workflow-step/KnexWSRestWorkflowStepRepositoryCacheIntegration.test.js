import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';

describe('KnexWSRestWorkflowStepRepository cache', () => {
    const repository = new KnexWSRestWorkflowStepRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000040' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });
});
