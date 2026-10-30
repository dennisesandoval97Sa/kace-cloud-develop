import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { AdapterDeleter } from '../../../../src/rabbitmq/application/delete/AdapterDeleter.js';
import { KnexAdapterSettingsRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';
import { knexConfig } from '../../../knexfile.js';

const insertAdapter = async (repository, overrides = {}) => {
    const id = uuidv4();
    await repository.connection('broker_adapters').insert({
        id,
        name: `Adapter-${id}`,
        host: 'broker.local',
        port: 5672,
        queue: 'test-queue',
        ...overrides,
    });
    return id;
};

describe('AdapterDeleter', () => {
    const repository = new KnexAdapterSettingsRepository(knexConfig);

    it('throws a 404 CustomError when the adapter does not exist', async () => {
        const deleter = new AdapterDeleter(repository);

        await expect(deleter.execute(uuidv4())).rejects.toMatchObject({ statusCode: 404 });
    });

    // Este test SOBRESCRIBE saveHistory con un jest.fn() (motivo de fallo inventado) para
    // probar la resiliencia de execute() ante CUALQUIER fallo de historial, sea cual sea la
    // causa. NO ejercita el saveHistory real heredado -- para eso ver el test siguiente, que
    // usa el repositorio sin sobrescribir nada.
    it('soft-deletes an existing adapter and does not fail when saveHistory rejects, regardless of the reason (mocked failure)', async () => {
        const id = await insertAdapter(repository);
        const repositoryWithFailingHistory = new KnexAdapterSettingsRepository(knexConfig);
        const saveHistory = jest.fn().mockRejectedValue(new Error('history backend unavailable'));
        repositoryWithFailingHistory.saveHistory = saveHistory;
        const deleter = new AdapterDeleter(repositoryWithFailingHistory);

        await deleter.execute(id);

        expect(saveHistory).toHaveBeenCalledTimes(1);
        expect(saveHistory.mock.calls[0][0]).toEqual({ id, deleted: true });
        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.deleted_by).toBe('system');
        expect(row.deleted_at).not.toBeNull();
    });

    // BUG DE PRODUCCION (real, sin mockear saveHistory): igual que en AdapterCreator/
    // AdapterUpdater, `KnexRepository.saveHistory` heredado llama `aggregate.toJson()` sobre
    // el objeto plano `{ id, deleted: true }` (AdapterDeleter.js:33), que no lo tiene: revienta
    // con `TypeError: aggregate.toJson is not a function`, y el try/catch de
    // AdapterDeleter.js:31-38 lo traga en silencio (Helper.logError(e)). Se verifica con un spy
    // sobre Helper.logError, repositorio real sin sobrescribir nada.
    it('BUG: the real (inherited, non-mocked) saveHistory always throws TypeError("aggregate.toJson is not a function"), and it is swallowed silently', async () => {
        const id = await insertAdapter(repository);
        const logErrorSpy = jest.spyOn(Helper, 'logError');
        const deleter = new AdapterDeleter(repository);

        await deleter.execute(id);

        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        const [loggedError] = logErrorSpy.mock.calls[0];
        expect(loggedError).toBeInstanceOf(TypeError);
        expect(loggedError.message).toBe('aggregate.toJson is not a function');

        const row = await repository.connection('broker_adapters').where({ id }).first();
        expect(row.deleted_by).toBe('system');

        logErrorSpy.mockRestore();
    });

    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexAdapterSettingsRepository(knexConfig);
        const id = await insertAdapter(realRepository);
        const repositoryWithoutSaveHistory = {
            findById: realRepository.findById.bind(realRepository),
            delete: realRepository.delete.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const deleter = new AdapterDeleter(repositoryWithoutSaveHistory);

        await deleter.execute(id);

        const row = await realRepository.connection('broker_adapters').where({ id }).first();
        expect(row.deleted_by).toBe('system');
    });
});
