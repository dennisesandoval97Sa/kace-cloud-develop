import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ValidationService } from '../../../src/rabbitmq/domain/ValidationService.js';
import { KnexAdapterSettingsRepository } from '../../../src/rabbitmq/infrastructure/persistence/KnexAdapterSettingsRepository.js';
import { KnexMapperRepository } from '../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { knexConfig } from '../../knexfile.js';

describe('ValidationService', () => {
    describe('validateAdapterNameUnique (real KnexAdapterSettingsRepository, which implements findByName)', () => {
        const repository = new KnexAdapterSettingsRepository(knexConfig);

        it('does nothing when name is falsy', async () => {
            const service = new ValidationService(repository);

            await expect(service.validateAdapterNameUnique('')).resolves.toBeUndefined();
            await expect(service.validateAdapterNameUnique(null)).resolves.toBeUndefined();
        });

        it('does nothing when no adapter with that name exists', async () => {
            const service = new ValidationService(repository);

            await expect(service.validateAdapterNameUnique(`no-such-adapter-${uuidv4()}`)).resolves.toBeUndefined();
        });

        it('throws a 400 CustomError when an adapter with that name already exists', async () => {
            const name = `Adapter-${uuidv4()}`;
            await repository.connection('broker_adapters').insert({
                id: uuidv4(),
                name,
                host: 'localhost',
                port: 5672,
                queue: 'test_queue',
            });
            const service = new ValidationService(repository);

            await expect(service.validateAdapterNameUnique(name)).rejects.toMatchObject({
                message: `Adapter with name ${name} already exists`,
                statusCode: 400,
            });
        });
    });

    describe('validateMapperNameUnique', () => {
        it('does nothing when name is falsy (real KnexMapperRepository)', async () => {
            const repository = new KnexMapperRepository(knexConfig);
            const service = new ValidationService(repository);

            await expect(service.validateMapperNameUnique('')).resolves.toBeUndefined();
        });

        // KnexMapperRepository (src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js) does NOT
        // implement `findByName` at all, so `validateMapperNameUnique` against the real repository always
        // takes the "!this.#repository.findByName" skip branch. To exercise the "existing mapper" branch
        // we need a collaborator that DOES implement findByName; this is a generic validation service
        // (works against any repository shape), not the persistence layer itself, so a stub collaborator
        // here documents/exercises an interface the real Mapper repository does not (yet) support.
        it('does nothing when the repository does not implement findByName at all', async () => {
            const repositoryWithoutFindByName = {};
            const service = new ValidationService(repositoryWithoutFindByName);

            await expect(service.validateMapperNameUnique('Some Mapper')).resolves.toBeUndefined();
        });

        it('does nothing when findByName resolves to no match', async () => {
            const repository = { findByName: jest.fn().mockResolvedValue(null) };
            const service = new ValidationService(repository);

            await expect(service.validateMapperNameUnique('Some Mapper')).resolves.toBeUndefined();
            expect(repository.findByName).toHaveBeenCalledWith('Some Mapper');
        });

        it('throws a 400 CustomError when a mapper with that name already exists', async () => {
            const repository = { findByName: jest.fn().mockResolvedValue({ id: uuidv4(), name: 'Some Mapper' }) };
            const service = new ValidationService(repository);

            await expect(service.validateMapperNameUnique('Some Mapper')).rejects.toMatchObject({
                message: 'Mapper with name Some Mapper already exists',
                statusCode: 400,
            });
        });
    });
});
