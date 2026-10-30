import { v4 as uuidv4 } from 'uuid';
import { AuxUsers } from '../../../src/aux_usuarios/domain/AuxUsers';
import { ensureParentRow } from '../../support/ensureParentRow.js';

export class AuxUsersMother {
    /**
     * Postgres exige que exista la fila padre de `usuario_id`. Se garantiza
     * siempre, tambien cuando el llamador fijo el id: `ensureParentRow` es
     * idempotente, asi que respaldar una fila que ya existe no cuesta nada.
     *
     * Se expone como metodo propio -y no solo dentro de `createAuxUser`- porque
     * el archivo de integracion nunca pasa por la factoria: toma el dto y se lo
     * da al repositorio o al caso de uso, asi que necesita el mismo respaldo.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRow(connection, 'usuarios', dto.usuario_id);
    }

    static dto({ usuario_id, data } = {}) {
        return {
            id: uuidv4(),
            usuario_id: usuario_id ?? uuidv4(),
            data: data ?? {
                codigo: '123',
                ciudad: 'Medellín',
                barrio: 'Alcaran',
                direccion: 'clle alcaran 12-34',
            },
            created_at: new Date(),
            created_by: uuidv4(),
        };
    }

    /**
     *
     * @param {KnexAuxUsersRepository} repository
     * @param {object} overrides
     * @returns {Promise<KnexAuxUsersRepository>}
     */
    static async createAuxUser(repository, overrides = {}) {
        const dto = this.dto(overrides);
        await AuxUsersMother.ensureRelations(repository.connection, dto);
        const auxUser = AuxUsers.create(dto);
        await repository.save(auxUser);
        return auxUser;
    }
}
