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

describe('KnexUsersRepository.listByActiveGroup', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`TRUNCATE TABLE ${schema}.usuarios CASCADE`);
        await knex.raw(`TRUNCATE TABLE ${schema}.grupos CASCADE`);
    });

    async function insertGroups(...ids) {
        await knex(`${schema}.grupos`).insert(ids.map((id) => ({ id, nombre: `g_${id.slice(0, 8)}`, status: 1 })));
    }

    it('returns empty array when nobody has the group as grupo_activo', async () => {
        const groupId = uuid();
        await knex(`${schema}.usuarios`).insert([userRow({ id: uuid(), grupo_activo: null })]);
        await expect(repo.listByActiveGroup(groupId, 2)).resolves.toEqual([]);
    });

    it('returns non-deleted users with expected fields ordered by name', async () => {
        const groupId = uuid();
        const otherGroupId = uuid();
        await insertGroups(groupId, otherGroupId);
        const recent = new Date().toISOString();

        await knex(`${schema}.usuarios`).insert([
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Zoe',
                apellido1: 'Zeta',
                apellido2: null,
                email: 'zoe@x.io',
                last_seen_at: recent,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Ana',
                apellido1: 'Alfa',
                apellido2: 'Beta',
                email: 'ana@x.io',
                last_seen_at: recent,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Gone',
                apellido1: 'X',
                apellido2: 'Y',
                email: 'gone@x.io',
                deleted_at: new Date(),
            }),
            userRow({
                id: uuid(),
                grupo_activo: otherGroupId,
                nombres: 'Other',
                apellido1: 'User',
                apellido2: 'Z',
                email: 'other@x.io',
            }),
        ]);

        const rows = await repo.listByActiveGroup(groupId, 2);
        expect(rows).toEqual([
            { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
            { nombres: 'Zoe', apellido1: 'Zeta', apellido2: null, email: 'zoe@x.io' },
        ]);
    });

    it('orders users alphabetically case-insensitively by name', async () => {
        const groupId = uuid();
        await insertGroups(groupId);
        const recent = new Date().toISOString();

        await knex(`${schema}.usuarios`).insert([
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Test',
                apellido1: 'Felipe',
                apellido2: 'Yepes',
                email: 'test@mail.com',
                last_seen_at: recent,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'jose.aviles',
                apellido1: 'konecta.com',
                apellido2: null,
                email: 'jose.aviles@konecta.com',
                last_seen_at: recent,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'test',
                apellido1: 'test',
                apellido2: 'test',
                email: 'test@correo.com',
                last_seen_at: recent,
            }),
        ]);

        const rows = await repo.listByActiveGroup(groupId, 2);
        // jose.aviles < test/Test; then apellido1: Felipe < test
        expect(rows.map((row) => row.email)).toEqual(['jose.aviles@konecta.com', 'test@mail.com', 'test@correo.com']);
    });

    it('lists only users with last_seen_at within the session window', async () => {
        const groupId = uuid();
        await insertGroups(groupId);
        const recent = new Date().toISOString();
        const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        await knex(`${schema}.usuarios`).insert([
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Ana',
                apellido1: 'Alfa',
                apellido2: 'Beta',
                email: 'ana@x.io',
                last_seen_at: recent,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Old',
                apellido1: 'User',
                apellido2: null,
                email: 'old@x.io',
                last_seen_at: stale,
            }),
            userRow({
                id: uuid(),
                grupo_activo: groupId,
                nombres: 'Null',
                apellido1: 'Seen',
                apellido2: null,
                email: 'null@x.io',
                last_seen_at: null,
            }),
        ]);

        await expect(repo.listByActiveGroup(groupId, 2)).resolves.toEqual([
            { nombres: 'Ana', apellido1: 'Alfa', apellido2: 'Beta', email: 'ana@x.io' },
        ]);
    });
});
