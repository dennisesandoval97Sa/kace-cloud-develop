import {
    UserNotification,
    UserNotificationCollectionResponse,
    UserNotificationCounter,
    UserNotificationCreator,
    UserNotificationDeleter,
    UserNotificationFinder,
    UserNotificationResponse,
    UserNotificationSearcher,
    UserNotificationUpdater,
    KnexUserNotificationRepository,
} from '../../src/user-notifications';
import UserNotificationsMother from './domain/UserNotificationsMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('UserNotification Integration Tests', () => {
    const repository = new KnexUserNotificationRepository(knexConfig);

    it('should create a UserNotification', async () => {
        const dto = UserNotificationsMother.dto();
        const userNotificationCreator = new UserNotificationCreator(repository);

        await userNotificationCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(repository);
        const userNotificationFinder = new UserNotificationFinder(repository);

        const userNotificationResult = await userNotificationFinder.execute(userNotification.id.value);

        expect(userNotificationResult).not.toBeNull();
        expect(userNotificationResult).toBeInstanceOf(UserNotificationResponse);
    });

    it('can update an existing UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(repository);
        const userNotificationUpdater = new UserNotificationUpdater(repository);

        const newValues = { asunto: 'updated subject' };
        await userNotificationUpdater.execute(userNotification.id.value, newValues);

        const result = await repository.find(userNotification.id);
        expect(result).toBeInstanceOf(UserNotification);
        expect(result.asunto.value).toBe(newValues.asunto);
    });

    it('can delete an existing UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(repository);
        const userNotificationDeleter = new UserNotificationDeleter(repository);

        await userNotificationDeleter.execute(userNotification.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(userNotification.id);
        expect(result).toBeInstanceOf(UserNotification);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for UserNotification instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await UserNotificationsMother.createUserNotification(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const userNotificationSearch = new UserNotificationSearcher(repository);

        const userNotificationResult = await userNotificationSearch.execute(dtoCriteria);
        expect(userNotificationResult).toBeInstanceOf(UserNotificationCollectionResponse);
    });

    it('searches for UserNotifications with criteria that match no records', async () => {
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
        const userNotificationSearch = new UserNotificationSearcher(repository);

        const userNotificationResult = await userNotificationSearch.execute(dtoCriteria);
        expect(userNotificationResult).toBeInstanceOf(UserNotificationCollectionResponse);
        expect(userNotificationResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a UserNotification with a non-existent ID', async () => {
        const userNotificationFinder = new UserNotificationFinder(repository);

        await expect(userNotificationFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a UserNotification with invalid data', async () => {
        const invalidDto = UserNotificationsMother.dto();
        delete invalidDto.id;
        const userNotificationCreator = new UserNotificationCreator(repository);

        await expect(userNotificationCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent UserNotification', async () => {
        const userNotificationUpdater = new UserNotificationUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { asunto: 'updated subject' };

        await expect(userNotificationUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `User notification with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw an error when deleting a non-existent UserNotification', async () => {
        const userNotificationDeleter = new UserNotificationDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            userNotificationDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuidv4(),
            })
        ).rejects.toThrow(`User notification with ID ${nonExistentId} does not exist.`);
    });

    it('should handle creating multiple UserNotifications with the same ID', async () => {
        const dto = UserNotificationsMother.dto();
        const userNotificationCreator = new UserNotificationCreator(repository);

        await userNotificationCreator.execute(dto);

        await expect(userNotificationCreator.execute(dto)).rejects.toThrow();
    });

    it('should count UserNotifications correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await UserNotificationsMother.createUserNotification(repository);
        }
        const counter = new UserNotificationCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should throw an error when creating a UserNotification with duplicate fields', async () => {
        const dto1 = UserNotificationsMother.dto();
        const dto2 = UserNotificationsMother.dto();
        dto2.asunto = dto1.asunto;
        dto2.mensaje = dto1.mensaje;
        dto2.user_id = dto1.user_id;

        const userNotificationCreator = new UserNotificationCreator(repository);
        await userNotificationCreator.execute(dto1);
        await expect(userNotificationCreator.execute(dto2)).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: asunto '${dto2.asunto}', mensaje '${dto2.mensaje}', user_id '${dto2.user_id}'.`
            )
        );
    });

    it('should throw an error when updating a UserNotification to have duplicate fields', async () => {
        const notification1 = await UserNotificationsMother.createUserNotification(repository);
        const notification2 = await UserNotificationsMother.createUserNotification(repository);

        const userNotificationUpdater = new UserNotificationUpdater(repository);
        await expect(
            userNotificationUpdater.execute(notification2.id.value, { asunto: notification1.asunto.value })
        ).rejects.toThrow(
            new CustomError(
                `The following value(s) already exist: asunto '${notification1.asunto.value}', mensaje '${notification2.mensaje.value}', user_id '${notification2.user_id.value}'.`
            )
        );
    });
});
