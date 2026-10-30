import { v4 as uuidv4 } from 'uuid';
import { AuxDefinition } from '../../../src/aux_definitions/domain/AuxDefinition.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export class AuxDefinitionsMother {
    /**
     * `aux_definitions` tiene FK reales sobre `schemas` y `ws_rest_flows` que nunca
     * se respaldaron: el dto inventa ambos ids con `uuidv4()`.
     *
     * Se garantizan SIEMPRE: `ensureParentRow` es idempotente y las columnas salen
     * de pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'schemas', id: dto.schema_id },
            { table: 'ws_rest_flows', id: dto.restflow_id },
        ]);
    }

    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            name: 'nombre_aux',
            tablename: 'aux_test_table',
            logs_tablename: 'logs_test_table',
            schema_id: uuidv4(),
            restflow_id: uuidv4(),
            is_active: true,
            created_at: new Date(),
            created_by: uuidv4(),
            updated_at: new Date(),
            updated_by: uuidv4(),
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }

    static create(overrides = {}) {
        return AuxDefinition.create(this.dto(overrides));
    }
}
