import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GroupUsageGuard } from '../../src/grupos';
import { CustomError } from '../../src/shared/index.js';
import { GROUP_HAS_ACTIVE_USERS } from '@kace/error-codes';

describe('GroupUsageGuard', () => {
    const groupId = uuidv4();
    const users = [
        { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
        { nombres: 'Zoe', apellido1: 'Zeta', apellido2: null, email: 'zoe@x.io' },
    ];

    const limitResolver = (minutes = 7) => ({
        resolveForGroup: jest.fn().mockResolvedValue(minutes),
    });

    it('resolves silently when no recently-active users have the group as grupo_activo', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(0),
            listByActiveGroup: jest.fn().mockResolvedValue([]),
        };
        const resolver = limitResolver(7);
        const guard = new GroupUsageGuard(usersRepoMock, resolver);

        await expect(guard.ensureNoActiveAssignments(groupId)).resolves.toBeUndefined();
        expect(resolver.resolveForGroup).toHaveBeenCalledWith(groupId);
        expect(usersRepoMock.countByActiveGroup).toHaveBeenCalledWith(groupId, 7);
        expect(usersRepoMock.listByActiveGroup).not.toHaveBeenCalled();
    });

    it('throws CustomError 400 with code, count and users when recently-active assignments exist', async () => {
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockResolvedValue(2),
            listByActiveGroup: jest.fn().mockResolvedValue(users),
        };
        const resolver = limitResolver(7);
        const guard = new GroupUsageGuard(usersRepoMock, resolver);

        let error;
        try {
            await guard.ensureNoActiveAssignments(groupId);
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(GROUP_HAS_ACTIVE_USERS);
        expect(error.fields).toEqual({ count: 2, users });
        expect(error.message).toBe('Cannot proceed: 2 user(s) still have this group as their active group');
        expect(usersRepoMock.listByActiveGroup).toHaveBeenCalledWith(groupId, 7);
    });

    it('propagates repository errors', async () => {
        const dbError = new Error('boom');
        const usersRepoMock = {
            countByActiveGroup: jest.fn().mockRejectedValue(dbError),
            listByActiveGroup: jest.fn(),
        };
        const guard = new GroupUsageGuard(usersRepoMock, limitResolver());

        await expect(guard.ensureNoActiveAssignments(groupId)).rejects.toBe(dbError);
    });
});
