import { jest } from '@jest/globals';
import { AgentCasesConfigFinder } from '../../src/global-config/domain/AgentCasesConfigFinder.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { Helper } from '../../src/shared/index.js';
import { CASE_REOPEN_CONFIG_UNAVAILABLE } from '@kace/error-codes';

describe('AgentCasesConfigFinder', () => {
    const configurationId = '11111111-1111-4111-8111-111111111111';
    const grupo = { id: { value: 'g1' }, configuration_id: { value: configurationId } };

    it('throws when configuration_id is missing', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const finder = new AgentCasesConfigFinder({ find: async () => null });

        await expect(finder.execute({ id: { value: 'g1' }, configuration_id: { value: null } })).rejects.toThrow(
            ValidationFailError
        );
        logSpy.mockRestore();
    });

    it('returns agent casos config from global configuration', async () => {
        const casos = { reopen_cases_only_last_days: 0 };
        const finder = new AgentCasesConfigFinder({
            find: async () => ({
                settings: {
                    behaviors: {
                        getConfig: (application, module) =>
                            application === 'agente' && module === 'casos' ? casos : null,
                    },
                },
            }),
        });

        await expect(finder.execute(grupo)).resolves.toEqual(casos);
    });

    it('returns empty object and logs error when load fails', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const finder = new AgentCasesConfigFinder({
            find: async () => {
                throw new Error('db down');
            },
        });

        await expect(finder.execute(grupo)).resolves.toEqual({});
        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });

    it('throws a generic unavailable error when load fails and failOnError is true', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const finder = new AgentCasesConfigFinder({
            find: async () => {
                throw new Error('db down');
            },
        });

        await expect(finder.execute(grupo, { failOnError: true })).rejects.toMatchObject({
            message: 'Global configuration is unavailable',
            statusCode: 503,
        });
        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });

    it('uses the caller-supplied public error code when load fails', async () => {
        const logSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const finder = new AgentCasesConfigFinder({
            find: async () => {
                throw new Error('db down');
            },
        });

        await expect(
            finder.execute(grupo, { failOnError: true, unavailableErrorCode: CASE_REOPEN_CONFIG_UNAVAILABLE })
        ).rejects.toMatchObject({
            message: 'Global configuration is unavailable',
            statusCode: 503,
            publicErrorCode: CASE_REOPEN_CONFIG_UNAVAILABLE,
        });
        logSpy.mockRestore();
    });
});
