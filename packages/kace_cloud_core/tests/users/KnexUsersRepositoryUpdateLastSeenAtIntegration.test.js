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

describe('KnexUsersRepository.updateLastSeenAt (stale guard)', () => {
    const knex = knexConfig;
    const repo = new KnexUsersRepository(knex);
    const schema = knexConfig.config.schema;

    beforeEach(async () => {
        await knex.raw(`TRUNCATE TABLE ${schema}.usuarios CASCADE`);
    });

    const now = new Date('2026-06-23T12:00:00.000Z');
    const nowIso = now.toISOString();
    const thresholdIso = new Date(now.getTime() - 2 * 60 * 1000).toISOString(); // 11:58:00Z

    it('writes when last_seen_at is NULL', async () => {
        const id = uuid();
        await knex(`${schema}.usuarios`).insert(userRow({ id, last_seen_at: null }));

        await repo.updateLastSeenAt(id, nowIso, CREATED_BY, thresholdIso);

        const row = await knex(`${schema}.usuarios`).where({ id }).first();
        expect(new Date(row.last_seen_at).toISOString()).toBe(nowIso);
    });

    it('writes when last_seen_at is older than the threshold', async () => {
        const id = uuid();
        const old = new Date('2026-06-23T11:50:00.000Z').toISOString(); // 10 min old
        await knex(`${schema}.usuarios`).insert(userRow({ id, last_seen_at: old }));

        await repo.updateLastSeenAt(id, nowIso, CREATED_BY, thresholdIso);

        const row = await knex(`${schema}.usuarios`).where({ id }).first();
        expect(new Date(row.last_seen_at).toISOString()).toBe(nowIso);
    });

    it('does NOT write when last_seen_at is newer than the threshold', async () => {
        const id = uuid();
        const recent = new Date('2026-06-23T11:59:30.000Z').toISOString(); // 30 s old, within 2 min
        await knex(`${schema}.usuarios`).insert(userRow({ id, last_seen_at: recent }));

        await repo.updateLastSeenAt(id, nowIso, CREATED_BY, thresholdIso);

        const row = await knex(`${schema}.usuarios`).where({ id }).first();
        expect(new Date(row.last_seen_at).toISOString()).toBe(recent);
    });
});
