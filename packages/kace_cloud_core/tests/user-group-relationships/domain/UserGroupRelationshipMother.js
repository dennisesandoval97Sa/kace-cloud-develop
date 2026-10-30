import { v4 as uuidv4 } from 'uuid';
import { UserGroupRelationship } from '../../../src/user-group-relationships';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class UserGroupRelationshipMother {
    /**
     * Postgres exige que existan el usuario y el grupo referenciados. Se
     * garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya
     * existe no cuesta nada.
     *
     * Se expone como metodo propio -y no solo dentro de `create`- porque los
     * archivos de integracion toman el dto y se lo pasan al caso de uso sin
     * pasar por la factoria.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'usuarios', id: dto.usuario_id, extra: { is_active: '1' } },
            { table: 'grupos', id: dto.grupo_id, extra: { status: 1 } },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `UserGroupRelationship` entity.
     *
     * @returns {Object} The DTO containing the properties for an `UserGroupRelationship` entity.
     */
    static dto({ usuario_id, grupo_id } = {}) {
        return {
            usuario_id: usuario_id ?? uuidv4(),
            grupo_id: grupo_id ?? uuidv4(),
        };
    }

    /**
     * Creates an `UserGroupRelationship` instance and saves it to the repository.
     *
     * @param {KnexUserGroupRelationshipRepository} repository - The repository to save the `UserGroupRelationship` instance.
     * @returns {UserGroupRelationship} The created `UserGroupRelationship` instance.
     */
    static async create(repository, data = {}) {
        const dto = UserGroupRelationshipMother.dto(data);

        await UserGroupRelationshipMother.ensureRelations(repository.connection, dto);

        const userGroupRelationship = UserGroupRelationship.create(dto);
        await repository.save(userGroupRelationship);
        return userGroupRelationship;
    }
}
