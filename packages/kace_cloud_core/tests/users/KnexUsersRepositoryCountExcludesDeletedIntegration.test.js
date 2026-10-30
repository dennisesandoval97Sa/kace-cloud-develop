import { v4 as uuid } from 'uuid';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { Criteria } from '../../src/shared/criteria/Criteria.js';
import { knexConfig } from '../knexfile.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

function userRow(override = {}) {
    return {
        id: uuid(),
        login: `user_${uuid()}`,
        nombres: 'Fixture',
        apellido1: 'User',
        email: 'fixture@x.io',
        rol_id: globalRoleId,
        is_active: 1,
        account_type: 1,
        created_at: new Date(),
        ...override,
    };
}

describe('KnexUsersRepository counts exclude soft-deleted users', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);
    const schema = knexConfig.config.schema;
    const groupId = uuid();

    beforeEach(async () => {
        await knex.raw(`SET search_path TO ${schema}`);
        await knex.raw('TRUNCATE TABLE usuarios CASCADE');
        await knex.raw('TRUNCATE TABLE grupos CASCADE');
        await knex('grupos').insert({ id: groupId, nombre: 'Grupo', status: 1 });

        const active = userRow();
        const deleted = userRow({ deleted_at: new Date(), deleted_by: uuid() });
        await knex('usuarios').insert([active, deleted]);
        await knex('rel_usuarios_grupos').insert([
            { usuario_id: active.id, grupo_id: groupId },
            { usuario_id: deleted.id, grupo_id: groupId },
        ]);
    });

    it('count() ignores soft-deleted users when the criteria has no deleted_at filter', async () => {
        const criteria = new Criteria(undefined, undefined, 0, 0, undefined, 'usuarios');

        const { count } = await repo.count(criteria);

        expect(Number(count)).toBe(1);
    });

    it('countUsers() ignores soft-deleted members of the requested groups', async () => {
        const { count } = await repo.countUsers([], undefined, [groupId]);

        expect(Number(count)).toBe(1);
    });
});
