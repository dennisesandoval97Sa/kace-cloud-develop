import { jest } from '@jest/globals';
import { ViewCasesResponsibleCounter } from '../../../src/cases/index.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';

const buildRepository = ({ responsible = {} } = {}) => ({
    tableName: 'view_test_cases',
    getResponsibleCountsFromView: jest.fn().mockResolvedValue(responsible),
});

describe('ViewCasesResponsibleCounter', () => {
    it('returns the responsible contract from repository', async () => {
        const responsible = {
            1: { id: 1, nombre: 'Juan Perez', estados: [{ id: 1, estado: 'Abierto', count: 4 }] },
        };
        const repository = buildRepository({ responsible });

        const result = await new ViewCasesResponsibleCounter(repository).execute();

        expect(result).toEqual({ data: { responsible } });
        expect(repository.getResponsibleCountsFromView).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from getResponsibleCountsFromView', async () => {
        const repository = buildRepository();
        repository.getResponsibleCountsFromView.mockRejectedValue(new QueryDBError('count'));

        await expect(new ViewCasesResponsibleCounter(repository).execute()).rejects.toBeInstanceOf(QueryDBError);
    });

    it('returns empty responsible object when matview has no rows', async () => {
        const repository = buildRepository({ responsible: {} });

        const result = await new ViewCasesResponsibleCounter(repository).execute();

        expect(result).toEqual({ data: { responsible: {} } });
    });
});
