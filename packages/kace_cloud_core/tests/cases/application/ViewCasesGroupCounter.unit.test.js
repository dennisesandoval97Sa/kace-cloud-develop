import { jest } from '@jest/globals';
import { ViewCasesGroupCounter } from '../../../src/cases/index.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';

const buildRepository = ({ groups = {} } = {}) => ({
    tableName: 'view_test_cases',
    getGroupCountsFromView: jest.fn().mockResolvedValue(groups),
});

describe('ViewCasesGroupCounter', () => {
    it('returns the groups contract from repository', async () => {
        const groups = { 1: { id: 1, nombre: 'Grupo A', estados: [{ id: 1, estado: 'Abierto', count: 4 }] } };
        const repository = buildRepository({ groups });

        const result = await new ViewCasesGroupCounter(repository).execute();

        expect(result).toEqual({ data: { groups } });
        expect(repository.getGroupCountsFromView).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from getGroupCountsFromView', async () => {
        const repository = buildRepository();
        repository.getGroupCountsFromView.mockRejectedValue(new QueryDBError('count'));

        await expect(new ViewCasesGroupCounter(repository).execute()).rejects.toBeInstanceOf(QueryDBError);
    });

    it('returns empty groups object when matview has no rows', async () => {
        const repository = buildRepository({ groups: {} });

        const result = await new ViewCasesGroupCounter(repository).execute();

        expect(result).toEqual({ data: { groups: {} } });
    });
});
