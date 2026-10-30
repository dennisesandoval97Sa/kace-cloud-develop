import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { AuxUsers } from '../../domain/AuxUsers';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexAuxUsersRepository extends KnexRepository {
    constructor(config) {
        super(config, 'aux_usuarios');
    }

    async save(dto) {
        try {
            await this.table().insert({
                id: dto.id.value,
                usuario_id: dto.usuario_id.value,
                data: dto.data.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
            });
            return true;
        } catch (error) {
            Helper.logError('Error saving aux users', error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<AuxUsers>}
     */
    async find(id) {
        try {
            const auxUser = await this.table().select('*').where({ id: id.value }).first();
            return auxUser ? new AuxUsers(auxUser) : null;
        } catch (error) {
            Helper.logError('Error finding aux user', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} userId
     * @returns {Promise<AuxUsers>}
     */
    async findByUser(userId) {
        try {
            const auxUser = await this.table().select('*').where({ usuario_id: userId.value }).first();
            return auxUser ? new AuxUsers(auxUser) : null;
        } catch (error) {
            Helper.logError('Error saving aux users', error);
            throw new QueryDBError('find');
        }
    }
}
