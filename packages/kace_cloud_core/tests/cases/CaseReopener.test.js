import { jest } from '@jest/globals';
import { CaseReopener } from '../../src/cases/application/re-open/CaseReopener.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import {
    CASE_REOPEN_CASE_NOT_CLOSED,
    CASE_REOPEN_CASE_NOT_FOUND,
    CASE_REOPEN_NO_ACTIVE_GROUP,
    CASE_REOPEN_USER_GROUP_NOT_FOUND,
} from '@kace/error-codes';

describe('CaseReopener constructor', () => {
    it('requires commentsRepository', () => {
        expect(() => new CaseReopener({}, {}, {})).toThrow(InvalidArgumentError);
    });
});

describe('CaseReopener public error codes', () => {
    function makeReopener({ findCase = async () => null, findGroup = async () => ({}) } = {}) {
        const caseRepository = { find: findCase };
        const groupsRepository = { find: findGroup };
        return new CaseReopener(caseRepository, groupsRepository, {}, {});
    }

    it('throws CASE_REOPEN_CASE_NOT_FOUND when the case does not exist', async () => {
        await expect(makeReopener().execute('11111111-1111-4111-8111-111111111111', {})).rejects.toMatchObject({
            statusCode: 404,
            publicErrorCode: CASE_REOPEN_CASE_NOT_FOUND,
        });
    });

    it('throws CASE_REOPEN_CASE_NOT_CLOSED when the case is open', async () => {
        const reopener = makeReopener({
            findCase: async () => ({ fecha_resolucion: { value: null } }),
        });

        await expect(reopener.execute('11111111-1111-4111-8111-111111111111', {})).rejects.toMatchObject({
            statusCode: 400,
            publicErrorCode: CASE_REOPEN_CASE_NOT_CLOSED,
        });
    });

    it('throws CASE_REOPEN_NO_ACTIVE_GROUP when userGroupId is missing', async () => {
        const reopener = makeReopener({
            findCase: async () => ({ fecha_resolucion: { value: new Date() } }),
        });

        await expect(reopener.execute('11111111-1111-4111-8111-111111111111', {})).rejects.toMatchObject({
            statusCode: 400,
            publicErrorCode: CASE_REOPEN_NO_ACTIVE_GROUP,
        });
    });

    it('throws CASE_REOPEN_USER_GROUP_NOT_FOUND when the user group does not exist', async () => {
        const reopener = makeReopener({
            findCase: async () => ({ fecha_resolucion: { value: new Date() } }),
            findGroup: async () => null,
        });

        await expect(
            reopener.execute(
                '11111111-1111-4111-8111-111111111111',
                {},
                { userGroupId: '11111111-1111-4111-8111-111111111111' }
            )
        ).rejects.toMatchObject({
            statusCode: 404,
            publicErrorCode: CASE_REOPEN_USER_GROUP_NOT_FOUND,
        });
    });
});

describe('CaseReopener deprecated comment id', () => {
    it('rejects a missing comment before starting the persist transaction', async () => {
        const caseId = '11111111-1111-4111-8111-111111111111';
        const commentId = '22222222-2222-4222-8222-222222222222';
        const startTransaction = jest.fn();
        const reopener = new CaseReopener(
            {
                find: async () => ({
                    fecha_resolucion: { value: new Date() },
                    created_at: { value: new Date() },
                }),
                startTransaction,
            },
            { find: async () => ({ configuration_id: { value: 'cfg' } }) },
            {},
            { find: async () => null }
        );
        reopener.agentCasesConfigFinder.execute = async () => ({ reopen_cases_only_last_days: 0 });

        await expect(
            reopener.execute(caseId, { cambio_estado_comentario_id: commentId }, { userGroupId: caseId })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'The comment does not exist',
        });
        expect(startTransaction).not.toHaveBeenCalled();
    });
});
