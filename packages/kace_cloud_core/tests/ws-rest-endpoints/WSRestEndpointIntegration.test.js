import { WSRestEndpointCounter } from '../../src/ws-rest-endpoints/domain/WSRestEndpointCounter.js';
import { WSRestEndpoint } from '../../src/ws-rest-endpoints/domain/WSRestEndpoint.js';
import { WSRestEndpointCreator } from '../../src/ws-rest-endpoints/application/create/WSRestEndpointCreator.js';
import { WSRestEndpointUpdater } from '../../src/ws-rest-endpoints/application/update/WSRestEndpointUpdater.js';
import { WSRestEndpointFinder } from '../../src/ws-rest-endpoints/application/find/WSRestEndpointFinder.js';
import { WSRestEndpointDeleter } from '../../src/ws-rest-endpoints/application/delete/WSRestEndpointDeleter.js';
import { WSRestEndpointSearcher } from '../../src/ws-rest-endpoints/application/search/WSRestEndpointSearcher.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { WSRestEndpointResponse } from '../../src/ws-rest-endpoints/application/WSRestEndpointResponse.js';
import { WSRestEndpointCollectionResponse } from '../../src/ws-rest-endpoints/application/WSRestEndpointCollectionResponse.js';
import WSRestEndpointMother from './domain/WSRestEndpointMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';

describe('WSRestEndpoint Integration Tests', () => {
    const repository = new KnexWSRestEndpointRepository(knexConfig);
    const secretsRepository = new KnexSecretsVaultRepository(knexConfig);

    it('should create a WSRestEndpoint', async () => {
        const dto = WSRestEndpointMother.dto();
        const wsRestEndpointCreator = new WSRestEndpointCreator(repository);

        await wsRestEndpointCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const wsRestEndpointFinder = new WSRestEndpointFinder(repository);

        const wsRestEndpointResult = await wsRestEndpointFinder.execute(wsRestEndpoint.id.value);

        expect(wsRestEndpointResult).not.toBeNull();
        expect(wsRestEndpointResult).toBeInstanceOf(WSRestEndpointResponse);
    });

    it('can update an existing WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const wsRestEndpointUpdater = new WSRestEndpointUpdater(repository);

        const newValues = { description: 'Updated endpoint description' };
        await wsRestEndpointUpdater.execute(wsRestEndpoint.id.value, newValues);

        const result = await repository.find(wsRestEndpoint.id);
        expect(result).toBeInstanceOf(WSRestEndpoint);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const wsRestEndpointDeleter = new WSRestEndpointDeleter(repository);

        await wsRestEndpointDeleter.execute(wsRestEndpoint.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(wsRestEndpoint.id);
        expect(result).toBeInstanceOf(WSRestEndpoint);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for WSRestEndpoints with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await WSRestEndpointMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const wsRestEndpointSearcher = new WSRestEndpointSearcher(repository);

        const searchResult = await wsRestEndpointSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(WSRestEndpointCollectionResponse);
    });

    it('should throw an error when creating an existing WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const wsRestEndpointCreator = new WSRestEndpointCreator(repository);

        const dto = { ...WSRestEndpointMother.dto(), id: wsRestEndpoint.id.value };
        await expect(wsRestEndpointCreator.execute(dto)).rejects.toThrow(
            new CustomError(`WSRestEndpoint with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to find a WSRestEndpoint with a non-existent ID', async () => {
        const wsRestEndpointFinder = new WSRestEndpointFinder(repository);

        await expect(wsRestEndpointFinder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a WSRestEndpoint with invalid data', async () => {
        const dto = WSRestEndpointMother.dto();
        delete dto.id;
        const wsRestEndpointCreator = new WSRestEndpointCreator(repository);

        await expect(wsRestEndpointCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent WSRestEndpoint', async () => {
        const wsRestEndpointUpdater = new WSRestEndpointUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(wsRestEndpointUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `WSRestEndpoint with id ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent WSRestEndpoint', async () => {
        const wsRestEndpointDeleter = new WSRestEndpointDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            wsRestEndpointDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toThrow(`WSRestEndpoint with id ${nonExistentId} does not exist.`);
    });

    it('should count WSRestEndpoint instances correctly', async () => {
        // Los pasos de flujo referencian ws_rest_endpoints; postgres no deja borrar
        // el padre mientras el hijo exista.
        await repository.connection('ws_rest_workflow_steps').del();
        await repository.connection(repository.tableName).del();
        for (let i = 0; i < 10; i++) {
            await WSRestEndpointMother.create(repository);
        }
        const counter = new WSRestEndpointCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should throw error when creating endpoint with non-existing SECRET references', async () => {
        const dto = WSRestEndpointMother.dto();

        dto.url = 'https://SECRET_API_URL/cases/SECRET_ENDPOINT';
        dto.headers = {
            headers: {
                'x-tenant-id': 'SECRET_TENANT',
            },
        };

        const creator = new WSRestEndpointCreator(repository, secretsRepository);

        await expect(creator.execute(dto)).rejects.toThrow('Secret references not found');
    });

    it('should create endpoint when all SECRET references exist in vault', async () => {
        const dto = WSRestEndpointMother.dto();

        dto.url = 'https://SECRET_API_URL/cases/SECRET_ENDPOINT';
        dto.headers = {
            headers: {
                'x-tenant-id': 'SECRET_TENANT',
            },
        };

        await repository.connection('boveda_secretos').insert([
            { id: uuid(), referencia: 'API_URL' },
            { id: uuid(), referencia: 'ENDPOINT' },
            { id: uuid(), referencia: 'TENANT' },
        ]);

        const creator = new WSRestEndpointCreator(repository, secretsRepository);

        await expect(creator.execute(dto)).resolves.not.toThrow();
    });

    it('should return missing secret references when some do not exist', async () => {
        const dto = WSRestEndpointMother.dto();

        dto.url = 'https://SECRET_API_URL/cases/SECRET_ENDPOINT';

        await repository.connection('boveda_secretos').insert([{ id: uuid(), referencia: 'API_URL' }]);

        const creator = new WSRestEndpointCreator(repository, secretsRepository);

        await expect(creator.execute(dto)).rejects.toThrow('Secret references not found: ENDPOINT');
    });

    it('should throw error when updating endpoint with non-existing SECRET references', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);

        const updater = new WSRestEndpointUpdater(repository, secretsRepository);

        const updateDto = {
            url: 'https://SECRET_NEW_SECRET/service',
        };

        await expect(updater.execute(wsRestEndpoint.id.value, updateDto)).rejects.toThrow(
            'Secret references not found'
        );
    });

    it('should update endpoint when SECRET references exist', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);

        await repository.connection('boveda_secretos').insert([{ id: uuid(), referencia: 'NEW_SECRET' }]);

        const updater = new WSRestEndpointUpdater(repository, secretsRepository);

        const updateDto = {
            url: 'https://SECRET_NEW_SECRET/service',
        };

        await expect(updater.execute(wsRestEndpoint.id.value, updateDto)).resolves.not.toThrow();
    });
});
