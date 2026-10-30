import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { UserLastSeenUpdater } from '../../../src/users/application/update/UserLastSeenUpdater.js';
import { USER_ACTIVITY_STALENESS_MS } from '../../../src/users/domain/userActivityStaleness.js';

describe('UserLastSeenUpdater', () => {
    const userId = uuidv4();
    const updatedBy = uuidv4();

    it('delegates to updateLastSeenAt with now and a 2-minute-old threshold', async () => {
        const repository = { updateLastSeenAt: jest.fn().mockResolvedValue(undefined) };

        await new UserLastSeenUpdater(repository).execute(userId, updatedBy);

        expect(repository.updateLastSeenAt).toHaveBeenCalledTimes(1);
        const [id, nowIso, by, threshold] = repository.updateLastSeenAt.mock.calls[0];
        expect(id).toBe(userId);
        expect(by).toBe(updatedBy);
        expect(new Date(nowIso).getTime() - new Date(threshold).getTime()).toBe(USER_ACTIVITY_STALENESS_MS);
    });

    it('does not perform a redundant SELECT (repository.find is never called)', async () => {
        const repository = {
            updateLastSeenAt: jest.fn().mockResolvedValue(undefined),
            find: jest.fn(),
        };

        await new UserLastSeenUpdater(repository).execute(userId, updatedBy);

        expect(repository.find).not.toHaveBeenCalled();
    });

    it('rejects an invalid userId before touching the repository', async () => {
        const repository = { updateLastSeenAt: jest.fn() };

        await expect(new UserLastSeenUpdater(repository).execute('not-a-uuid', updatedBy)).rejects.toThrow();
        expect(repository.updateLastSeenAt).not.toHaveBeenCalled();
    });
});
