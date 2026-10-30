import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { GroupRelationsCleaner } from '../../src/grupos';
import { ensureParentRows } from '../support/ensureParentRow.js';

describe('GroupRelationsCleaner', () => {
    const knex = knexConfig;

    const insertMemberships = async (rows) => {
        await ensureParentRows(
            knex,
            rows.flatMap(({ usuario_id, grupo_id }) => [
                { table: 'usuarios', id: usuario_id },
                { table: 'grupos', id: grupo_id },
            ])
        );
        await knex('rel_usuarios_grupos').insert(rows);
    };

    it('hard-deletes only the rel_usuarios_grupos rows for the given groupId', async () => {
        const groupId = uuidV4();
        const otherGroupId = uuidV4();

        await insertMemberships([
            { usuario_id: uuidV4(), grupo_id: groupId },
            { usuario_id: uuidV4(), grupo_id: groupId },
            { usuario_id: uuidV4(), grupo_id: otherGroupId },
        ]);

        const cleaner = new GroupRelationsCleaner(knex);
        const removed = await cleaner.execute(groupId, { actorId: uuidV4(), reason: 'group_deleted' });

        expect(removed).toBe(2);

        const remainingForGroup = await knex('rel_usuarios_grupos').where({ grupo_id: groupId });
        const remainingForOther = await knex('rel_usuarios_grupos').where({ grupo_id: otherGroupId });
        expect(remainingForGroup).toHaveLength(0);
        expect(remainingForOther).toHaveLength(1);
    });

    it('writes one history row per deleted relationship with condition, original_attributes and created_by', async () => {
        const groupId = uuidV4();
        const actorId = uuidV4();
        const userA = uuidV4();
        const userB = uuidV4();

        await insertMemberships([
            { usuario_id: userA, grupo_id: groupId },
            { usuario_id: userB, grupo_id: groupId },
        ]);

        const cleaner = new GroupRelationsCleaner(knex);
        await cleaner.execute(groupId, { actorId, reason: 'group_deactivated' });

        const history = await knex('rel_usuarios_grupos_history').select('*');
        expect(history).toHaveLength(2);

        for (const row of history) {
            expect(row.created_by).toBe(actorId);
            const condition = typeof row.condition === 'string' ? JSON.parse(row.condition) : row.condition;
            expect(condition).toEqual({ groupId, reason: 'group_deactivated' });
            const original =
                typeof row.original_attributes === 'string'
                    ? JSON.parse(row.original_attributes)
                    : row.original_attributes;
            expect(original.grupo_id).toBe(groupId);
            expect([userA, userB]).toContain(original.usuario_id);
        }
    });

    it('returns 0 and writes no history when there are no relationships', async () => {
        const groupId = uuidV4();

        const cleaner = new GroupRelationsCleaner(knex);
        const removed = await cleaner.execute(groupId, { actorId: uuidV4(), reason: 'group_deleted' });

        expect(removed).toBe(0);
        const history = await knex('rel_usuarios_grupos_history').select('*');
        expect(history).toHaveLength(0);
    });

    it('rolls back history + delete when the trx is rolled back', async () => {
        const groupId = uuidV4();
        await insertMemberships([
            { usuario_id: uuidV4(), grupo_id: groupId },
            { usuario_id: uuidV4(), grupo_id: groupId },
        ]);

        const cleaner = new GroupRelationsCleaner(knex);

        await expect(
            knex.transaction(async (trx) => {
                await cleaner.execute(groupId, { actorId: uuidV4(), reason: 'group_deleted', trx });
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');

        const remaining = await knex('rel_usuarios_grupos').where({ grupo_id: groupId });
        const history = await knex('rel_usuarios_grupos_history').select('*');
        expect(remaining).toHaveLength(2);
        expect(history).toHaveLength(0);
    });
});
