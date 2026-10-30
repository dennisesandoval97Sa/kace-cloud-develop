import { v4 as uuidv4 } from 'uuid';
import { KnexUsersRepository } from '../../../src/users/infrastructure/KnexUsersRepository.js';
import UsersMother from '../domain/UsersMother.js';
import { knexConfig } from '../../knexfile.js';

describe('KnexUsersRepository.countUsers without groupIds (groupIds?.length > 0 false branch)', () => {
    const repository = new KnexUsersRepository(knexConfig);

    it('counts by filter alone when groupIds is null (no membership join applied)', async () => {
        const uniqueLogin = `count-users-${uuidv4()}`;
        await UsersMother.createUser(repository, { login: uniqueLogin });

        const result = await repository.countUsers(
            [{ field: 'login', operator: 'eq', value: uniqueLogin, type: 'AND' }],
            undefined,
            null
        );

        expect(Number(result.count)).toBe(1);
    });
});
