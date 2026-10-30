import { v4 as uuidv4 } from 'uuid';
import { OneScript } from '../../../src/one-script';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class OneScriptMother {
    /**
     * Postgres exige que exista la fila padre de `one-script.schema_id`, que nunca
     * se respaldo: el dto inventa el id con `uuidv4()`.
     *
     * Se garantiza SIEMPRE, tambien cuando el llamador fijo el id: `ensureParentRow`
     * es idempotente. La columna sale de pg_constraint, no de mirar el dto.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [{ table: 'schemas', id: dto.schema_id }]);
    }

    static dto(overrides = {}) {
        return {
            id: uuidv4(),
            name: 'Nombre de pruebaDDD GG',
            url: 'https://ejemplo.com',
            url_api: 'https://ejemplo.com',
            schema_id: uuidv4(),
            onescript_reference_id: uuidv4(),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    static async createOneScript(repository) {
        const dto = OneScriptMother.dto();
        await OneScriptMother.ensureRelations(repository.connection, dto);
        const oneScript = OneScript.create(dto);
        await repository.save(oneScript);
        return oneScript;
    }
}
