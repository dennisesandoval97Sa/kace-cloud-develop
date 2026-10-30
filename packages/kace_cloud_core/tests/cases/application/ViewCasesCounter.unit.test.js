import { jest } from '@jest/globals';
import { ViewCasesCounter } from '../../../src/cases/index.js';
import { QueryDBError } from '../../../src/shared/errors/QueryDBError.js';

const buildRepository = ({ ans = {}, states = [] } = {}) => ({
    tableName: 'view_test_cases',
    getAnsCountsFromView: jest.fn().mockResolvedValue(ans),
    getStateCountsFromView: jest.fn().mockResolvedValue(states),
});

describe('ViewCasesCounter', () => {
    it('returns the ans and states contract from repository', async () => {
        const ans = { pending: 2, toOvercome: 1, defeated: 1, managed: 3 };
        const states = [{ id: 1, nombre: 'Abierto', icon_class: null, count: '4' }];
        const repository = buildRepository({ ans, states });

        const result = await new ViewCasesCounter(repository).execute();

        expect(result).toEqual({ data: { ans, states } });
        expect(repository.getAnsCountsFromView).toHaveBeenCalledTimes(1);
        expect(repository.getStateCountsFromView).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from getAnsCountsFromView', async () => {
        const repository = buildRepository();
        repository.getAnsCountsFromView.mockRejectedValue(new QueryDBError('count'));

        await expect(new ViewCasesCounter(repository).execute()).rejects.toBeInstanceOf(QueryDBError);
    });

    it('propagates errors from getStateCountsFromView', async () => {
        const repository = buildRepository();
        repository.getStateCountsFromView.mockRejectedValue(new QueryDBError('count'));

        await expect(new ViewCasesCounter(repository).execute()).rejects.toBeInstanceOf(QueryDBError);
    });
});
