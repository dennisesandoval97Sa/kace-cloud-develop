import { jest } from '@jest/globals';
import { ActiveGroupFinderByExternalCode } from '../../src/grupos/domain/ActiveGroupFinderByExternalCode.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

/**
 * Assignment actions resolve their target group from an external code. An inactive
 * (or soft-deleted) group must behave as "not found" so callers fall through to the
 * classification's default group instead of routing cases to a group that no longer
 * operates. The status/deleted_at guard therefore lives in the criteria, not in the
 * callers.
 */
describe('ActiveGroupFinderByExternalCode', () => {
    const makeRepo = (searchImpl) => ({
        tableName: 'grupos',
        search: jest.fn(searchImpl),
    });

    /** Criteria qualifies every field as `<table>.<column>`. */
    const readFilters = (criteria) =>
        criteria.filters.filters.map((filter) => ({
            field: filter.field.value.split('.').pop(),
            operator: filter.operator.value,
            value: filter.value.value,
        }));

    /** Mimics `KnexGroupsRepository.search` honouring the criteria filters. */
    const makeRepoOverRows = (rows) =>
        makeRepo(async (criteria) => {
            const filters = readFilters(criteria);

            const externalCodeFilter = filters.find(
                (filter) => filter.field === 'codigo_externo' || filter.field === 'codigos_externos'
            );
            const wantsActive = filters.some(
                (filter) => filter.field === 'status' && Number(filter.value) === StatusEnum.ACTIVE.value
            );
            const wantsNotDeleted = filters.some((filter) => filter.field === 'deleted_at');

            return rows.filter((row) => {
                const matchesCode =
                    externalCodeFilter.field === 'codigo_externo'
                        ? row.codigo_externo === externalCodeFilter.value
                        : (row.codigos_externos ?? []).includes(externalCodeFilter.value);

                if (!matchesCode) return false;
                if (wantsActive && row.status !== StatusEnum.ACTIVE.value) return false;
                if (wantsNotDeleted && row.deleted_at) return false;
                return true;
            });
        });

    const row = (overrides) => ({
        id: { value: 'g-default' },
        codigo_externo: null,
        codigos_externos: null,
        status: StatusEnum.ACTIVE.value,
        deleted_at: null,
        ...overrides,
    });

    it('returns the group matched by codigo_externo when it is active', async () => {
        const repo = makeRepoOverRows([row({ id: { value: 'g-active' }, codigo_externo: 'CODE' })]);

        const group = await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(group.id.value).toBe('g-active');
    });

    it('returns null when the only group with that codigo_externo is inactive', async () => {
        const repo = makeRepoOverRows([
            row({ id: { value: 'g-inactive' }, codigo_externo: 'CODE', status: StatusEnum.INACTIVE.value }),
        ]);

        const group = await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(group).toBeNull();
        expect(repo.search).toHaveBeenCalledTimes(2); // eq + jsonb fallback, both empty
    });

    it('falls back to codigos_externos when the codigo_externo match is inactive', async () => {
        const repo = makeRepoOverRows([
            row({ id: { value: 'g-inactive' }, codigo_externo: 'CODE', status: StatusEnum.INACTIVE.value }),
            row({ id: { value: 'g-active' }, codigos_externos: ['OTHER', 'CODE'] }),
        ]);

        const group = await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(group.id.value).toBe('g-active');
    });

    it('returns null when the matching group is soft-deleted', async () => {
        const repo = makeRepoOverRows([
            row({ id: { value: 'g-deleted' }, codigo_externo: 'CODE', deleted_at: '2026-01-01T00:00:00.000Z' }),
        ]);

        const group = await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(group).toBeNull();
    });

    it('returns null when no group carries the external code', async () => {
        const repo = makeRepoOverRows([row({ id: { value: 'g-other' }, codigo_externo: 'ANOTHER' })]);

        const group = await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(group).toBeNull();
    });

    it('constrains both queries to active, non-deleted groups', async () => {
        const repo = makeRepo(async () => []);

        await new ActiveGroupFinderByExternalCode(repo).execute('CODE');

        expect(repo.search).toHaveBeenCalledTimes(2);
        for (const [criteria] of repo.search.mock.calls) {
            const filters = readFilters(criteria);
            expect(filters).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'status', value: StatusEnum.ACTIVE.value }),
                    expect.objectContaining({ field: 'deleted_at' }),
                ])
            );
        }
    });
});
