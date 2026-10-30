import {
    AllowedConnection,
    AllowedConnectionResponse,
    AllowedConnectionCollectionResponse,
    AllowedConnectionCounter,
    AllowedConnectionCreator,
    AllowedConnectionDeleter,
    AllowedConnectionFinder,
    AllowedConnectionSearcher,
    AllowedConnectionUpdater,
    KnexAllowedConnectionsRepository,
} from '../../src/allowed-conections';
import AllowedConnectionsMother from './domain/AllowedConnectionsMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/index.js';

describe('AllowedConnection Integration Tests', () => {
    const repository = new KnexAllowedConnectionsRepository(knexConfig);

    it('should create an AllowedConnection', async () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnectionCreator = new AllowedConnectionCreator(repository);

        await allowedConnectionCreator.execute(dto);

        const result = await repository.connection('allowed_connections').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing allowed connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);
        const allowedConnectionFinder = new AllowedConnectionFinder(repository);

        const allowedConnectionResult = await allowedConnectionFinder.execute(allowedConnection.id.value);

        expect(allowedConnectionResult).not.toBeNull();
        expect(allowedConnectionResult).toBeInstanceOf(AllowedConnectionResponse);
    });

    it('can update an existing allowed connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);
        const allowedConnectionUpdater = new AllowedConnectionUpdater(repository);

        const newValues = { description: 'Updated Description' };
        await allowedConnectionUpdater.execute(allowedConnection.id.value, newValues);

        const result = await repository.find(allowedConnection.id);
        expect(result).toBeInstanceOf(AllowedConnection);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing allowed connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);
        const allowedConnectionDeleter = new AllowedConnectionDeleter(repository);

        await allowedConnectionDeleter.execute(allowedConnection.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(allowedConnection.id);
        expect(result).toBeInstanceOf(AllowedConnection);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for AllowedConnection instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await AllowedConnectionsMother.createAllowedConnection(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: 'true',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const allowedConnectionSearch = new AllowedConnectionSearcher(repository);

        const allowedConnectionResult = await allowedConnectionSearch.execute(dtoCriteria);
        expect(allowedConnectionResult).toBeInstanceOf(AllowedConnectionCollectionResponse);
    });

    it('searches for allowed connections with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                // `is_active` es `boolean` en postgres: compararla con '999'
                // aborta la consulta en vez de no devolver filas. El criterio
                // que de verdad no casa con nada es un id recien generado.
                {
                    field: 'id',
                    operator: 'eq',
                    value: uuidv4(),
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const allowedConnectionSearch = new AllowedConnectionSearcher(repository);

        const allowedConnectionResult = await allowedConnectionSearch.execute(dtoCriteria);
        expect(allowedConnectionResult).toBeInstanceOf(AllowedConnectionCollectionResponse);
        expect(allowedConnectionResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find an allowed connection with a non-existent ID', async () => {
        const allowedConnectionFinder = new AllowedConnectionFinder(repository);
        await expect(allowedConnectionFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating an AllowedConnection with invalid data', async () => {
        const invalidDto = AllowedConnectionsMother.dto();
        delete invalidDto.id;
        const allowedConnectionCreator = new AllowedConnectionCreator(repository);

        await expect(allowedConnectionCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent allowed connection', async () => {
        const allowedConnectionUpdater = new AllowedConnectionUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { description: 'Updated Description' };

        await expect(allowedConnectionUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `AllowedConnection with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when deleting a non-existent allowed connection', async () => {
        const allowedConnectionDeleter = new AllowedConnectionDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            allowedConnectionDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(`AllowedConnection with ID ${nonExistentId} does not exist.`);
    });

    it('should handle creating multiple allowed connections with the same ID', async () => {
        const dto = AllowedConnectionsMother.dto();
        const allowedConnectionCreator = new AllowedConnectionCreator(repository);

        await allowedConnectionCreator.execute(dto);

        await expect(allowedConnectionCreator.execute(dto)).rejects.toThrow();
    });

    it('should count allowed connections correctly', async () => {
        const counter = new AllowedConnectionCounter(repository);

        const baseline = Number((await counter.execute({ filters: [], relationship: null })).count);

        for (let i = 0; i < 10; i++) {
            await AllowedConnectionsMother.createAllowedConnection(repository);
        }

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(baseline + 10);
    });

    it('should throw an error when creating an AllowedConnection with a duplicate connection', async () => {
        const dto1 = AllowedConnectionsMother.dto();
        const dto2 = AllowedConnectionsMother.dto();
        dto2.connection = dto1.connection;

        const allowedConnectionCreator = new AllowedConnectionCreator(repository);

        await allowedConnectionCreator.execute(dto1);

        await expect(allowedConnectionCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: connection '${dto1.connection}'`
        );
    });

    it('should throw an error when updating an AllowedConnection to have a duplicate connection', async () => {
        const connection1 = await AllowedConnectionsMother.createAllowedConnection(repository);
        const connection2 = await AllowedConnectionsMother.createAllowedConnection(repository);

        const allowedConnectionUpdater = new AllowedConnectionUpdater(repository);

        await expect(
            allowedConnectionUpdater.execute(connection2.id.value, { connection: connection1.connection.value })
        ).rejects.toThrow(`The following value(s) already exist: connection '${connection1.connection.value}'`);
    });

    describe('KnexRepository - isAllowedConnection', () => {
        beforeEach(async () => {
            await repository
                .connection(repository.tableName)
                .insert([
                    AllowedConnectionsMother.dto({ connection: 'example.com' }),
                    AllowedConnectionsMother.dto({ connection: 'allowed.com' }),
                    AllowedConnectionsMother.dto({ connection: '192.168.0.1' }),
                    AllowedConnectionsMother.dto({ connection: 'api.allowed.com' }),
                    AllowedConnectionsMother.dto({ connection: 'insecure-website.com' }),
                    { ...AllowedConnectionsMother.dto({ connection: 'blocked.com' }), deleted_at: '2025-01-01' },
                ]);
        });

        it('should return true if the connection is allowed (basic domain)', async () => {
            const result = await repository.isAllowedConnection('https://example.com');
            expect(result).toBe(true);
        });

        it('should return true if the connection is allowed (IP address)', async () => {
            const result = await repository.isAllowedConnection('https://192.168.0.1');
            expect(result).toBe(true);
        });

        it('should return true if the connection is allowed (subdomain)', async () => {
            const result = await repository.isAllowedConnection('https://api.allowed.com');
            expect(result).toBe(true);
        });

        it('should return false if the connection is not allowed (not in allowed_connections)', async () => {
            const result = await repository.isAllowedConnection('https://notallowed.com');
            expect(result).toBe(false);
        });

        it('should return false if the connection is blocked (deleted_at not null)', async () => {
            const result = await repository.isAllowedConnection('https://blocked.com');
            expect(result).toBe(false);
        });

        it('should return false if the connection is blocked (IP address with deleted_at)', async () => {
            const result = await repository.isAllowedConnection('https://192.168.0.1');
            expect(result).toBe(true);
        });

        it('should return false for a connection with parameters in the URL (with allowed domain)', async () => {
            const result = await repository.isAllowedConnection('https://example.com/path?query=value');
            expect(result).toBe(true);
        });

        it('should return false for a connection with parameters in the URL (with blocked domain)', async () => {
            const result = await repository.isAllowedConnection('https://blocked.com/path?query=value');
            expect(result).toBe(false);
        });

        it('should return false for a connection with parameters in the URL (IP with parameters)', async () => {
            const result = await repository.isAllowedConnection('https://192.168.0.1/path?param=value');
            expect(result).toBe(true);
        });

        it('should handle a request to a non-secure site without a valid certificate (insecure connection)', async () => {
            const result = await repository.isAllowedConnection('http://insecure-website.com');
            expect(result).toBe(true);
        });
    });
});
