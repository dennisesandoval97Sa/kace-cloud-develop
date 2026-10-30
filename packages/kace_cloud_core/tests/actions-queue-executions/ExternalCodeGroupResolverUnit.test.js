import { jest } from '@jest/globals';
import { ExternalCodeGroupResolver } from '../../src/actions-queue-executions/domain/services/ExternalCodeGroupResolver.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

const makeRepo = (searchImpl) => ({
    tableName: 'grupos',
    search: jest.fn(searchImpl),
});

describe('ExternalCodeGroupResolver', () => {
    beforeEach(() => ExternalCodeGroupResolver.clearCache());

    it('resolves the group id from the codigo_externo eq query', async () => {
        const repo = makeRepo(async () => [{ id: { value: 42 } }]);
        const resolver = new ExternalCodeGroupResolver(repo);

        const groupId = await resolver.resolve('X1');

        expect(groupId).toBe('42'); // String() coercion, matches legacy service behavior
        expect(repo.search).toHaveBeenCalledTimes(1);
    });

    it('falls back to the codigos_externos jsonArrayValue query when eq returns empty', async () => {
        const repo = makeRepo(
            jest
                .fn()
                .mockResolvedValueOnce([]) // eq → empty
                .mockResolvedValueOnce([{ id: { value: 'g9' } }]) // fallback → hit
        );
        const resolver = new ExternalCodeGroupResolver(repo);

        const groupId = await resolver.resolve('X2');

        expect(groupId).toBe('g9');
        expect(repo.search).toHaveBeenCalledTimes(2);
    });

    it('caches a hit: a second resolve for the same code does not hit the repository', async () => {
        const repo = makeRepo(async () => [{ id: { value: 'g1' } }]);
        const resolver = new ExternalCodeGroupResolver(repo);

        await resolver.resolve('X3');
        await resolver.resolve('X3');

        expect(repo.search).toHaveBeenCalledTimes(1);
    });

    it('caches a null-hit: an unresolved code is not re-queried within the TTL', async () => {
        const repo = makeRepo(async () => []); // never resolves
        const resolver = new ExternalCodeGroupResolver(repo);

        const first = await resolver.resolve('X4');
        const second = await resolver.resolve('X4');

        expect(first).toBeNull();
        expect(second).toBeNull();
        // eq + fallback on the first call only (2), none on the cached second call
        expect(repo.search).toHaveBeenCalledTimes(2);
    });

    it('does not resolve an inactive group: both queries are constrained to status ACTIVE', async () => {
        // The repository honours the criteria, so an inactive group simply never comes back.
        const repo = makeRepo(async () => []);
        const resolver = new ExternalCodeGroupResolver(repo);

        const groupId = await resolver.resolve('X6');

        expect(groupId).toBeNull();
        for (const [criteria] of repo.search.mock.calls) {
            const statusFilter = criteria.filters.filters.find((filter) => filter.field.value.endsWith('.status'));
            expect(statusFilter?.value.value).toBe(StatusEnum.ACTIVE.value);
        }
    });

    it('clearCache() forces a re-query', async () => {
        const repo = makeRepo(async () => [{ id: { value: 'g1' } }]);
        const resolver = new ExternalCodeGroupResolver(repo);

        await resolver.resolve('X5');
        ExternalCodeGroupResolver.clearCache();
        await resolver.resolve('X5');

        expect(repo.search).toHaveBeenCalledTimes(2);
    });
});
