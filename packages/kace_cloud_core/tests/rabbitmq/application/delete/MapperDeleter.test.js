import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { MapperDeleter } from '../../../../src/rabbitmq/application/delete/MapperDeleter.js';
import { KnexMapperRepository } from '../../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';
import { knexConfig } from '../../../knexfile.js';
import MapperMother from '../../domain/MapperMother.js';

describe('MapperDeleter', () => {
    const repository = new KnexMapperRepository(knexConfig);

    it('throws a 404 CustomError when the mapper does not exist', async () => {
        const deleter = new MapperDeleter(repository);

        await expect(deleter.execute(uuidv4())).rejects.toMatchObject({ statusCode: 404 });
    });

    // Este test SOBRESCRIBE saveHistory con un jest.fn() (motivo de fallo inventado) para
    // probar la resiliencia de execute() ante CUALQUIER fallo de historial, sea cual sea la
    // causa. NO ejercita el saveHistory real heredado -- para eso ver el test siguiente, que
    // usa el repositorio sin sobrescribir nada.
    it('soft-deletes an existing mapper and does not fail when saveHistory rejects, regardless of the reason (mocked failure)', async () => {
        const dto = MapperMother.dto();
        await repository.create(dto);
        const repositoryWithFailingHistory = new KnexMapperRepository(knexConfig);
        const saveHistory = jest.fn().mockRejectedValue(new Error('history backend unavailable'));
        repositoryWithFailingHistory.saveHistory = saveHistory;
        const deleter = new MapperDeleter(repositoryWithFailingHistory);

        await deleter.execute(dto.id);

        expect(saveHistory).toHaveBeenCalledTimes(1);
        expect(saveHistory.mock.calls[0][0]).toEqual({ id: dto.id, deleted: true });
        const row = await repository.connection('broker_message_mappers').where({ id: dto.id }).first();
        expect(row.deleted_by).toBe('system');
        expect(row.deleted_at).not.toBeNull();
    });

    // BUG DE PRODUCCION (real, sin mockear saveHistory): igual que en MapperCreator, el
    // `KnexRepository.saveHistory` heredado llama `aggregate.toJson()` sobre el objeto plano
    // `{ id, deleted: true }` (MapperDeleter.js:33), que no lo tiene: revienta con
    // `TypeError: aggregate.toJson is not a function`, y el try/catch de
    // MapperDeleter.js:73-79 lo traga en silencio (Helper.logError(e)). Se verifica con un spy
    // sobre Helper.logError, repositorio real sin sobrescribir nada.
    it('BUG: the real (inherited, non-mocked) saveHistory always throws TypeError("aggregate.toJson is not a function"), and it is swallowed silently', async () => {
        const dto = MapperMother.dto();
        await repository.create(dto);
        const logErrorSpy = jest.spyOn(Helper, 'logError');
        const deleter = new MapperDeleter(repository);

        await deleter.execute(dto.id);

        expect(logErrorSpy).toHaveBeenCalledTimes(1);
        const [loggedError] = logErrorSpy.mock.calls[0];
        expect(loggedError).toBeInstanceOf(TypeError);
        expect(loggedError.message).toBe('aggregate.toJson is not a function');

        const row = await repository.connection('broker_message_mappers').where({ id: dto.id }).first();
        expect(row.deleted_by).toBe('system');

        logErrorSpy.mockRestore();
    });

    it('skips saveHistory entirely when the collaborator does not implement it at all', async () => {
        const realRepository = new KnexMapperRepository(knexConfig);
        const dto = MapperMother.dto();
        await realRepository.create(dto);
        const repositoryWithoutSaveHistory = {
            findById: realRepository.findById.bind(realRepository),
            delete: realRepository.delete.bind(realRepository),
        };
        expect(repositoryWithoutSaveHistory.saveHistory).toBeUndefined();
        const deleter = new MapperDeleter(repositoryWithoutSaveHistory);

        await deleter.execute(dto.id);

        const row = await realRepository.connection('broker_message_mappers').where({ id: dto.id }).first();
        expect(row.deleted_by).toBe('system');
    });
});
