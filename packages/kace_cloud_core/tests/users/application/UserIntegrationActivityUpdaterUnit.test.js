import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { UserIntegrationActivityUpdater } from '../../../src/users/application/update/UserIntegrationActivityUpdater.js';
import { User } from '../../../src/users/domain/User.js';
import UsersMother from '../domain/UsersMother.js';

function repositoryReturning(user) {
    return {
        find: jest.fn().mockResolvedValue(user),
        updateLastIntegrationActiveAt: jest.fn().mockResolvedValue(undefined),
        saveHistory: jest.fn().mockResolvedValue(undefined),
    };
}

describe('UserIntegrationActivityUpdater (stale guard)', () => {
    const userId = uuidv4();
    const timestamp = new Date().toISOString();

    it('skips update AND saveHistory when activity is recent (< 2 min)', async () => {
        const recent = new Date(Date.now() - 30 * 1000).toISOString(); // 30 s old
        const user = User.create({ ...UsersMother.systemUser(), id: userId, last_integration_active_at: recent });
        const repository = repositoryReturning(user);

        await new UserIntegrationActivityUpdater(repository).execute(userId, timestamp);

        expect(repository.updateLastIntegrationActiveAt).not.toHaveBeenCalled();
        expect(repository.saveHistory).not.toHaveBeenCalled();
    });

    it('writes and saves history when activity is stale (> 2 min)', async () => {
        const old = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min old
        const user = User.create({ ...UsersMother.systemUser(), id: userId, last_integration_active_at: old });
        const repository = repositoryReturning(user);

        await new UserIntegrationActivityUpdater(repository).execute(userId, timestamp);

        expect(repository.updateLastIntegrationActiveAt).toHaveBeenCalledWith(userId, timestamp);
        expect(repository.saveHistory).toHaveBeenCalledTimes(1);
    });

    it('writes and saves history when there is no previous activity (null)', async () => {
        const user = User.create({ ...UsersMother.systemUser(), id: userId, last_integration_active_at: null });
        const repository = repositoryReturning(user);

        await new UserIntegrationActivityUpdater(repository).execute(userId, timestamp);

        expect(repository.updateLastIntegrationActiveAt).toHaveBeenCalledWith(userId, timestamp);
        expect(repository.saveHistory).toHaveBeenCalledTimes(1);
    });

    it('throws when the user does not exist', async () => {
        const repository = repositoryReturning(null);

        await expect(new UserIntegrationActivityUpdater(repository).execute(userId, timestamp)).rejects.toThrow();
        expect(repository.updateLastIntegrationActiveAt).not.toHaveBeenCalled();
    });
});
