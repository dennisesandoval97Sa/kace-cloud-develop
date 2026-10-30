import { v4 as uuidv4 } from 'uuid';
import { Agenda } from '../../../src/agendas/domain/Agenda';
import { ensureParentRow } from '../../support/ensureParentRow.js';

export class AgendasMother {
    /**
     * Postgres exige que exista la fila padre de `one_script_id`, y el valor por
     * defecto de `dto()` es un `uuidv4()` que no respalda nada.
     *
     * La tabla padre se llama `one-script`, con guion. `ensureParentRow` la pasa
     * por el constructor de consultas de knex, que cita identificadores, asi que
     * el guion no es problema aqui -si lo seria en SQL crudo-.
     *
     * @param {import('knex').Knex} connection
     * @param {string} oneScriptId
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, oneScriptId) {
        await ensureParentRow(connection, 'one-script', oneScriptId);
    }

    static dto(oneScriptId = uuidv4()) {
        return {
            id: uuidv4(),
            description: 'description',
            is_active: true,
            one_script_id: oneScriptId,
            daily_limit: 10,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    static async create(repository, oneScriptId) {
        const agendaDto = AgendasMother.dto(oneScriptId);
        await AgendasMother.ensureRelations(repository.connection, agendaDto.one_script_id);
        const agenda = Agenda.create(agendaDto);
        await repository.save(agenda);
        return agenda;
    }

    static async createMany(repository, quantity, oneScriptId) {
        const agendas = [];
        for (let i = 0; i < quantity; i++) {
            agendas.push(await AgendasMother.create(repository, oneScriptId));
        }
        return agendas;
    }
}
