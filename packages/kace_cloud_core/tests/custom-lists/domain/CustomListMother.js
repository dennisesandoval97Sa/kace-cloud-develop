import { v4 as uuid } from 'uuid';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class CustomListMother {
    /**
     * `custom_lists_groups_relations.group_id` referencia a `grupos`, y los
     * grupos que viajan en `groups` son uuids inventados que nadie respalda:
     * sqlite no comprobaba la clave foranea y postgres si.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo los ids:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya
     * existe no cuesta nada. `aux_items` no entra aqui porque sus literales no
     * llevan clave foranea; la lista sale de pg_constraint, no del dto.
     *
     * @param {import('knex').Knex} connection
     * @param {{groups?: string[]}} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(
            connection,
            (dto.groups ?? []).map((id) => ({ table: 'grupos', id }))
        );
    }

    static dto(overrides = {}) {
        const id = uuid();
        return {
            id,
            name: `CustomList-${id.slice(0, 8)}`,
            is_active: true,
            aux_entity: 'aux_countries',
            aux_items: [
                { literal: uuid(), order: 1 },
                { literal: uuid(), order: 2 },
            ],
            groups: [],
            created_by: uuid(),
            ...overrides,
        };
    }
}
