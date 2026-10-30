import { v4 as uuid } from 'uuid';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { knexConfig } from '../knexfile.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const CREATED_BY = uuid();

function userRow(override = {}) {
    return {
        login: `user_${uuid()}`,
        nombres: 'Assignee',
        apellido1: 'User',
        apellido2: 'Test',
        email: `assignee_${uuid()}@x.io`,
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

describe('KnexUsersRepository Assignment Methods (findCandidateForWorkQueue & findByGroupForEquivalentAssignment)', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);
    let groupId;

    beforeEach(async () => {
        await knex('rel_usuarios_grupos').delete();
        await knex('cases').delete();
        await knex('usuarios').delete();
        await knex('grupos').delete();

        groupId = uuid();
        await knex('grupos').insert({
            id: groupId,
            nombre: 'Assignment Test Group',
            status: 1,
            created_at: new Date(),
            created_by: CREATED_BY,
        });
    });

    describe('findCandidateForWorkQueue', () => {
        it('excludes users with is_active != "1" or deleted_at IS NOT NULL', async () => {
            const activeUserId = uuid();
            const inactiveUserId = uuid();
            const deletedUserId = uuid();

            await knex('usuarios').insert([
                userRow({ id: activeUserId, is_active: '1', deleted_at: null }),
                userRow({ id: inactiveUserId, is_active: '2', deleted_at: null }),
                userRow({ id: deletedUserId, is_active: '1', deleted_at: new Date() }),
            ]);

            await knex('rel_usuarios_grupos').insert([
                { usuario_id: activeUserId, grupo_id: groupId },
                { usuario_id: inactiveUserId, grupo_id: groupId },
                { usuario_id: deletedUserId, grupo_id: groupId },
            ]);

            const candidates = await repo.findCandidateForWorkQueue(groupId);

            expect(candidates).toHaveLength(1);
            expect(candidates[0].responsable_id).toBe(activeUserId);
        });

        it('returns empty array when all group members are inactive or deleted', async () => {
            const inactiveUserId = uuid();
            const deletedUserId = uuid();

            await knex('usuarios').insert([
                userRow({ id: inactiveUserId, is_active: '2', deleted_at: null }),
                userRow({ id: deletedUserId, is_active: '1', deleted_at: new Date() }),
            ]);

            await knex('rel_usuarios_grupos').insert([
                { usuario_id: inactiveUserId, grupo_id: groupId },
                { usuario_id: deletedUserId, grupo_id: groupId },
            ]);

            const candidates = await repo.findCandidateForWorkQueue(groupId);

            expect(candidates).toHaveLength(0);
        });
    });

    describe('findByGroupForEquivalentAssignment', () => {
        it('excludes users with is_active != "1" or deleted_at IS NOT NULL', async () => {
            const activeUserId = uuid();
            const inactiveUserId = uuid();
            const deletedUserId = uuid();

            await knex('usuarios').insert([
                userRow({ id: activeUserId, is_active: '1', deleted_at: null }),
                userRow({ id: inactiveUserId, is_active: '2', deleted_at: null }),
                userRow({ id: deletedUserId, is_active: '1', deleted_at: new Date() }),
            ]);

            await knex('rel_usuarios_grupos').insert([
                { usuario_id: activeUserId, grupo_id: groupId },
                { usuario_id: inactiveUserId, grupo_id: groupId },
                { usuario_id: deletedUserId, grupo_id: groupId },
            ]);

            const candidates = await repo.findByGroupForEquivalentAssignment(groupId);

            expect(candidates).toHaveLength(1);
            expect(candidates[0].responsable_id).toBe(activeUserId);
        });

        it('returns empty array when all group members are inactive or deleted', async () => {
            const inactiveUserId = uuid();
            const deletedUserId = uuid();

            await knex('usuarios').insert([
                userRow({ id: inactiveUserId, is_active: '2', deleted_at: null }),
                userRow({ id: deletedUserId, is_active: '1', deleted_at: new Date() }),
            ]);

            await knex('rel_usuarios_grupos').insert([
                { usuario_id: inactiveUserId, grupo_id: groupId },
                { usuario_id: deletedUserId, grupo_id: groupId },
            ]);

            const candidates = await repo.findByGroupForEquivalentAssignment(groupId);

            expect(candidates).toHaveLength(0);
        });
    });
});
