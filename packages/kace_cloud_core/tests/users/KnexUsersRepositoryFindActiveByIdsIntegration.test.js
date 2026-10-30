import { v4 as uuid } from 'uuid';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const CREATED_BY = uuid();

function userRow(override = {}) {
    return {
        login: `user_${uuid()}`,
        nombres: 'Fixture',
        apellido1: 'User',
        apellido2: 'Test',
        email: 'fixture@x.io',
        telefono: '1234567890',
        movil: '0987654321',
        rol_id: globalRoleId,
        is_active: '1',
        created_at: new Date(),
        created_by: CREATED_BY,
        account_type: 1,
        ...override,
    };
}

describe('KnexUsersRepository.findActiveByIds + countActive', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);

    beforeEach(async () => {
        await knex.raw('TRUNCATE TABLE usuarios CASCADE');
    });

    it('findActiveByIds returns only active, non-deleted users among the given ids', async () => {
        const a = uuid(),
            b = uuid(),
            c = uuid(),
            d = uuid();
        await knex('usuarios').insert([
            userRow({ id: a, is_active: '1' }),
            userRow({ id: b, is_active: '0' }),
            userRow({ id: c, is_active: '1', deleted_at: new Date() }),
            userRow({ id: d, is_active: '1' }),
        ]);
        const result = await repo.findActiveByIds([a, b, c, d]);
        const ids = result.map((u) => u.id.value).sort();
        expect(ids).toEqual([a, d].sort());
    });

    it('findActiveByIds returns [] when ids is empty', async () => {
        const result = await repo.findActiveByIds([]);
        expect(result).toEqual([]);
    });

    it('countActive returns the count of active, non-deleted users', async () => {
        const a = uuid(),
            b = uuid();
        await knex('usuarios').insert([userRow({ id: a, is_active: '1' }), userRow({ id: b, is_active: '0' })]);
        const count = await repo.countActive();
        expect(count).toBe(1);
    });

    describe('findGroupsByUserIds', () => {
        beforeEach(async () => {
            await knex('rel_usuarios_grupos').delete();
            await knex('grupos').delete();
        });

        it('returns non-deleted groups (including inactive) for users, excluding soft-deleted', async () => {
            const userId = uuid();
            await knex('usuarios').insert(userRow({ id: userId, is_active: '1' }));

            const activeGroupId = uuid();
            const inactiveGroupId = uuid();
            const deletedGroupId = uuid();

            await knex('grupos').insert([
                { id: activeGroupId, nombre: 'Active Group', status: 1, deleted_at: null },
                { id: inactiveGroupId, nombre: 'Inactive Group', status: 2, deleted_at: null },
                { id: deletedGroupId, nombre: 'Deleted Group', status: 1, deleted_at: new Date() },
            ]);

            await knex('rel_usuarios_grupos').insert([
                { usuario_id: userId, grupo_id: activeGroupId },
                { usuario_id: userId, grupo_id: inactiveGroupId },
                { usuario_id: userId, grupo_id: deletedGroupId },
            ]);

            const map = await repo.findGroupsByUserIds([userId]);
            expect(map.has(userId)).toBe(true);
            const userGroups = map.get(userId);
            expect(userGroups).toHaveLength(2);
            expect(userGroups).toEqual(
                expect.arrayContaining([
                    { id: activeGroupId, nombre: 'Active Group' },
                    { id: inactiveGroupId, nombre: 'Inactive Group' },
                ])
            );
        });
    });
});
