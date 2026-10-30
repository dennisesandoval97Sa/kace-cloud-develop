import {
    ClientNotification,
    ClientNotificationCollectionResponse,
    ClientNotificationCounter,
    ClientNotificationCreator,
    ClientNotificationDeleter,
    ClientNotificationFinder,
    ClientNotificationResponse,
    ClientNotificationSearcher,
    ClientNotificationUpdater,
    KnexClientNotificationRepository,
} from '../../src/client-notifications';
import ClientNotificationsMother from './domain/ClientNotificationsMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/index.js';

describe('ClientNotification Integration Tests', () => {
    const repository = new KnexClientNotificationRepository(knexConfig);

    it('should create a ClientNotification', async () => {
        const dto = ClientNotificationsMother.dto();
        // El dto va al caso de uso sin pasar por `createClientNotification`,
        // que es quien respalda el cliente que la factoria inventa.
        await ClientNotificationsMother.ensureRelations(repository.connection, dto);
        const clientNotificationCreator = new ClientNotificationCreator(repository);

        await clientNotificationCreator.execute(dto);

        const result = await repository.connection('client_notifications').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing client notification', async () => {
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository);
        const clientNotificationFinder = new ClientNotificationFinder(repository);

        const clientNotificationResult = await clientNotificationFinder.execute(clientNotification.id.value);

        expect(clientNotificationResult).not.toBeNull();
        expect(clientNotificationResult).toBeInstanceOf(ClientNotificationResponse);
    });

    it('can update an existing client notification', async () => {
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository);
        const clientNotificationUpdater = new ClientNotificationUpdater(repository);

        const newValues = { subject: 'Updated Subject' };
        await clientNotificationUpdater.execute(clientNotification.id.value, newValues);

        const result = await repository.find(clientNotification.id);
        expect(result).toBeInstanceOf(ClientNotification);
        expect(result.subject.value).toBe(newValues.subject);
    });

    it('can delete an existing client notification', async () => {
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository);
        const clientNotificationDeleter = new ClientNotificationDeleter(repository);

        await clientNotificationDeleter.execute(clientNotification.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(clientNotification.id);
        expect(result).toBeInstanceOf(ClientNotification);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for ClientNotification instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await ClientNotificationsMother.createClientNotification(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: true,
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const clientNotificationSearch = new ClientNotificationSearcher(repository);

        const clientNotificationResult = await clientNotificationSearch.execute(dtoCriteria);
        expect(clientNotificationResult).toBeInstanceOf(ClientNotificationCollectionResponse);
        expect(Object.keys(clientNotificationResult.toJson().data.items[0])).not.toContain('data');
    });

    it('searches for client notifications with criteria that match no records', async () => {
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
        const clientNotificationSearch = new ClientNotificationSearcher(repository);

        const clientNotificationResult = await clientNotificationSearch.execute(dtoCriteria);
        expect(clientNotificationResult).toBeInstanceOf(ClientNotificationCollectionResponse);
        expect(clientNotificationResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a client notification with a non-existent ID', async () => {
        const clientNotificationFinder = new ClientNotificationFinder(repository);

        await expect(clientNotificationFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a ClientNotification with invalid data', async () => {
        const invalidDto = ClientNotificationsMother.dto();
        delete invalidDto.id;
        const clientNotificationCreator = new ClientNotificationCreator(repository);

        await expect(clientNotificationCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent client notification', async () => {
        const clientNotificationUpdater = new ClientNotificationUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { subject: 'Updated Subject' };

        await expect(clientNotificationUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `ClientNotification with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent client notification', async () => {
        const clientNotificationDeleter = new ClientNotificationDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            clientNotificationDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(`ClientNotification with ID ${nonExistentId} does not exist.`);
    });

    it('should handle creating multiple client notifications with the same ID', async () => {
        const dto = ClientNotificationsMother.dto();
        await ClientNotificationsMother.ensureRelations(repository.connection, dto);
        const clientNotificationCreator = new ClientNotificationCreator(repository);

        await clientNotificationCreator.execute(dto);

        await expect(clientNotificationCreator.execute(dto)).rejects.toThrow();
    });

    it('should count client notifications correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ClientNotificationsMother.createClientNotification(repository);
        }
        const counter = new ClientNotificationCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(count).toBe(10);
    });
});
