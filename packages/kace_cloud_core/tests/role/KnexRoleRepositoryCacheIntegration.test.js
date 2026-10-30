import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';

describe('KnexRoleRepository cache', () => {
    const repository = new KnexRoleRepository(knexConfig);

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000010' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });
});
