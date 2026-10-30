import { KnexTransitionsRepository } from '../../src/transition/infrastructure/persistance/KnexTransitionsRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';

describe('KnexTransitionsRepository cache', () => {
    const repository = new KnexTransitionsRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000020' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const transition = await TransitionsMother.createRandomTransition(repository);
        const id = { value: transition.id.value };

        const cached = await repository.find(id);
        expect(cached.ans_id.value).toBe(transition.ans_id.value);

        // Simulates a write from a different process: this process's cache is never invalidated.
        const otherAnsId = '99999999-9999-4999-8999-999999999999';
        await repository.table().where({ id: transition.id.value }).update({ ans_id: otherAnsId });

        const stillCached = await repository.find(id);
        expect(stillCached.ans_id.value).toBe(transition.ans_id.value);

        const fresh = await repository.find(id, { skipCache: true });
        expect(fresh.ans_id.value).toBe(otherAnsId);
    });
});
