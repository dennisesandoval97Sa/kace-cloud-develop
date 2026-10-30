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

describe('KnexUsersRepository.countByActiveGroup', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`SET search_path TO ${schema}`);
        await knex.raw('TRUNCATE TABLE usuarios CASCADE');
        await knex.raw('TRUNCATE TABLE grupos CASCADE');
    });

    async function insertGroups(...ids) {
        await knex('grupos').insert(ids.map((id) => ({ id, nombre: `g_${id.slice(0, 8)}`, status: 1 })));
    }

    it('returns 0 when no user has the given group as grupo_activo', async () => {
        const groupId = uuid();
        await knex('usuarios').insert([userRow({ id: uuid(), grupo_activo: null })]);

        const count = await repo.countByActiveGroup(groupId, 2);

        expect(count).toBe(0);
    });

    it('counts non-deleted users whose grupo_activo matches and excludes soft-deleted ones', async () => {
        const groupId = uuid();
        const otherGroupId = uuid();
        await insertGroups(groupId, otherGroupId);
        const recent = new Date().toISOString();

        await knex('usuarios').insert([
            userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: recent }),
            userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: recent }),
            userRow({ id: uuid(), grupo_activo: groupId, deleted_at: new Date() }),
            userRow({ id: uuid(), grupo_activo: otherGroupId }),
            userRow({ id: uuid(), grupo_activo: null }),
        ]);

        const count = await repo.countByActiveGroup(groupId, 2);

        expect(count).toBe(2);
    });

    it('returns 0 when all users point to a different group', async () => {
        const groupId = uuid();
        const otherGroupId = uuid();
        await insertGroups(otherGroupId);

        await knex('usuarios').insert([
            userRow({ id: uuid(), grupo_activo: otherGroupId }),
            userRow({ id: uuid(), grupo_activo: otherGroupId }),
        ]);

        const count = await repo.countByActiveGroup(groupId, 2);

        expect(count).toBe(0);
    });

    it('counts only users with last_seen_at within the session window', async () => {
        const groupId = uuid();
        await insertGroups(groupId);
        const recent = new Date().toISOString();
        const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        await knex('usuarios').insert([
            userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: recent }),
            userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: stale }),
            userRow({ id: uuid(), grupo_activo: groupId, last_seen_at: null }),
        ]);

        await expect(repo.countByActiveGroup(groupId, 2)).resolves.toBe(1);
    });
});
