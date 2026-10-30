import { v4 as uuidv4 } from 'uuid';
import { AgendasGroups } from '../../../src/agendas-groups/domain/AgendasGroups';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export class AgendasGroupsMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids con `uuidv4()` sin respaldarlos.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya existe
     * no cuesta nada, mientras que saltarsela deja el insert al borde de una
     * violacion. Las columnas salen de pg_constraint, no de mirar el dto.
     *
     * `agendas` no admite una fila con solo el id: `description`, `is_active` y
     * `daily_limit` son NOT NULL sin valor por defecto, asi que el respaldo
     * minimo tiene que traerlas o postgres responde 23502 en vez de dejar
     * pasar el insert.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            {
                table: 'agendas',
                id: dto.agenda_id,
                extra: { description: `agenda ${dto.agenda_id}`, is_active: true, daily_limit: 0 },
            },
            { table: 'grupos', id: dto.group_id },
        ]);
    }

    static dto({ agenda_id = uuidv4(), group_id = uuidv4() } = {}) {
        return { agenda_id, group_id };
    }

    /**
     * @param {KnexAgendasGroupsRepository} repository
     * @param {Object} data
     * @param {string} data.agenda_id
     * @param {string} data.group_id
     */
    static async create(repository, data = {}) {
        const dto = AgendasGroupsMother.dto(data);
        await AgendasGroupsMother.ensureRelations(repository.connection, dto);
        const agendasGroups = AgendasGroups.create(dto);
        await repository.save(agendasGroups);
        return agendasGroups;
    }
}
