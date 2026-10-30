import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { KnexUsersRepository } from '../../../src/users/infrastructure/KnexUsersRepository.js';
import { UserUpdater } from '../../../src/users/application/update/UserUpdater.js';
import { UserDeleter } from '../../../src/users/application/delete/UserDeleter.js';
import { UserFinder } from '../../../src/users/application/find/UserFinder.js';
import { UserBulkUpdater } from '../../../src/users/application/update/UserBulkUpdater.js';
import { ActionTriggers } from '../../../src/shared/domain/enum/ActionTriggersEnum.js';
import { ValidationFailError } from '../../../src/shared/errors/ValidationFailError.js';
import { CustomError } from '../../../src/shared/errors/CustomError.js';
import UsersMother from '../domain/UsersMother.js';
import { knexConfig } from '../../knexfile.js';

describe('Users application layer: actionExecutionService and isDeleted branches', () => {
    const repository = new KnexUsersRepository(knexConfig);

    describe('UserUpdater', () => {
        it('does not touch actionExecutionService when none is injected', async () => {
            const user = await UsersMother.createUser(repository);
            const updater = new UserUpdater(repository);

            await expect(updater.execute(user.id.value, { nombres: 'Actualizado' })).resolves.toBeUndefined();

            const updated = await repository.find(user.id);
            expect(updated.nombres.value).toBe('Actualizado');
        });

        it('invokes the injected actionExecutionService with the UPDATE_USER trigger and the updated user', async () => {
            const user = await UsersMother.createUser(repository);
            const actionExecutionService = { execute: jest.fn().mockResolvedValue(undefined) };
            const updater = new UserUpdater(repository, actionExecutionService);

            await updater.execute(user.id.value, { nombres: 'ConAccion' });

            expect(actionExecutionService.execute).toHaveBeenCalledTimes(1);
            const [trigger, updatedUser] = actionExecutionService.execute.mock.calls[0];
            expect(trigger).toBe(ActionTriggers.UPDATE_USER.value);
            expect(trigger).toBe('update_user');
            expect(updatedUser.id.value).toBe(user.id.value);
        });
    });

    describe('UserDeleter', () => {
        it('does not touch actionExecutionService when none is injected', async () => {
            const user = await UsersMother.createUser(repository);
            const deleter = new UserDeleter(repository);

            await expect(
                deleter.execute(user.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
            ).resolves.toBeUndefined();

            const deleted = await repository.find(user.id);
            expect(deleted.deleted_by.value).not.toBeNull();
        });

        it('invokes the injected actionExecutionService with the DELETE_USER trigger and the deleted user', async () => {
            const user = await UsersMother.createUser(repository);
            const actionExecutionService = { execute: jest.fn().mockResolvedValue(undefined) };
            const deleter = new UserDeleter(repository, actionExecutionService);

            await deleter.execute(user.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

            expect(actionExecutionService.execute).toHaveBeenCalledTimes(1);
            const [trigger, deletedUser] = actionExecutionService.execute.mock.calls[0];
            expect(trigger).toBe(ActionTriggers.DELETE_USER.value);
            expect(trigger).toBe('delete_user');
            expect(deletedUser.id.value).toBe(user.id.value);
        });

        it('throws a 404 CustomError when the user does not exist', async () => {
            const deleter = new UserDeleter(repository);

            await expect(
                deleter.execute(uuidv4(), { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
            ).rejects.toMatchObject({ message: 'User not found', statusCode: 404 });
            await expect(
                deleter.execute(uuidv4(), { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
            ).rejects.toBeInstanceOf(CustomError);
        });

        it('throws a 404 CustomError and keeps the original deletion when the user is already deleted', async () => {
            const user = await UsersMother.createUser(repository);
            const originalDeletion = { deleted_at: '2030-01-01T00:00:00.000Z', deleted_by: uuidv4() };
            const deleter = new UserDeleter(repository);
            await deleter.execute(user.id.value, originalDeletion);

            await expect(
                deleter.execute(user.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
            ).rejects.toMatchObject({ message: 'User not found', statusCode: 404 });

            const deleted = await repository.find(user.id);
            expect(new Date(deleted.deleted_at.value).toISOString()).toBe(originalDeletion.deleted_at);
            expect(deleted.deleted_by.value).toBe(originalDeletion.deleted_by);
        });
    });

    describe('UserFinder', () => {
        it('throws a 404 CustomError for a user that exists but was soft-deleted', async () => {
            const user = await UsersMother.createUser(repository);
            const deleter = new UserDeleter(repository);
            await deleter.execute(user.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

            const finder = new UserFinder(repository, user);

            await expect(finder.execute(user.id.value)).rejects.toMatchObject({
                message: 'User not found',
                statusCode: 404,
            });
            await expect(finder.execute(user.id.value)).rejects.toBeInstanceOf(CustomError);
        });
    });

    describe('UserBulkUpdater', () => {
        it('rejects an empty user_ids array before touching the repository', async () => {
            const updater = new UserBulkUpdater(repository);

            await expect(updater.execute([], { is_active: 2 })).rejects.toThrow(ValidationFailError);
            await expect(updater.execute([], { is_active: 2 })).rejects.toThrow('The user_ids array cannot be empty');
        });
    });
});
