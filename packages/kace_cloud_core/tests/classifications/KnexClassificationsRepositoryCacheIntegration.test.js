import { KnexClassificationRepository } from '../../src/classifications/infrastructure/persistence/KnexClassificationsRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import ClassificationsMother from './domain/ClassificationsMother.js';

describe('KnexClassificationRepository cache', () => {
    const repository = new KnexClassificationRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000030' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const classification = await ClassificationsMother.createClassification(repository, { nivel1: 'Original' });

        const id = { value: classification.id.value };
        const cached = await repository.find(id);
        expect(cached.nivel1.value).toBe('Original');

        // Simulates a write from a different process: this process's cache is never invalidated.
        await repository.table().where({ id: classification.id.value }).update({ nivel1: 'Updated elsewhere' });

        const stillCached = await repository.find(id);
        expect(stillCached.nivel1.value).toBe('Original');

        const fresh = await repository.find(id, { skipCache: true });
        expect(fresh.nivel1.value).toBe('Updated elsewhere');
    });
});
