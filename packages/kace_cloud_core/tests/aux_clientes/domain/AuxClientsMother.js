import { v4 as uuidv4 } from 'uuid';
import { AuxClients } from '../../../src/aux_clientes/index';
import { ensureParentRow } from '../../support/ensureParentRow.js';

export class AuxClientsMother {
    /**
     * Postgres exige que exista la fila padre de `cliente_id`. Se garantiza
     * siempre, tambien cuando el llamador fijo el id: `ensureParentRow` es
     * idempotente, asi que respaldar una fila que ya existe no cuesta nada.
     *
     * Se expone como metodo propio -y no solo dentro de `createAuxClient`-
     * porque el archivo de integracion toma el dto y se lo pasa al caso de uso
     * sin pasar por la factoria, y ahi hace falta el mismo respaldo.
     *
     * La tabla es `aux_clients` pese a que la constraint se llame
     * `aux_clientes_cliente_id_foreign`.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRow(connection, 'clients', dto.cliente_id);
    }

    static dto({ cliente_id, data } = {}) {
        return {
            id: uuidv4(),
            cliente_id: cliente_id ?? uuidv4(),
            data: data ?? {
                codigo: '123',
                ciudad: 'Medellín',
                barrio: 'Alcaran',
                direccion: 'clle alcaran 12-34',
                datos_alternos: {
                    barrio: 'Belen',
                    direccion: 'calle123',
                },
            },
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    /**
     *
     * @param {KnexAuxClientsRepository} repository
     * @param {object} overrides
     * @returns {Promise<AuxClients>}
     */
    static async createAuxClient(repository, overrides = {}) {
        const dto = this.dto(overrides);
        await AuxClientsMother.ensureRelations(repository.connection, dto);
        const auxClient = AuxClients.create(dto);
        await repository.save(auxClient);
        return auxClient;
    }
}
