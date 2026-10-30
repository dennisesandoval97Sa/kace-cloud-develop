import { KnexEventRepository } from '../../src/event-log/infrastructure/KnexEventRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';

describe('KnexEventRepository cache', () => {
    const repository = new KnexEventRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('countEventByCaseId returns same value on consecutive calls (cached)', async () => {
        const caseId = { value: '00000000-0000-0000-0000-000000000060' };

        const first = await repository.countEventByCaseId(caseId);
        const second = await repository.countEventByCaseId(caseId);

        expect(second).toBe(first);
    });
});
