import { EntityCache, KnexRepository } from '../../../shared';
import { Role } from '../../index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const ROLES_NAMESPACE = 'roles';
const ROLES_TTL_MS = 300_000;

export class KnexRoleRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'roles', readerConfig);
    }

    async save(role) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: role.id.value,
                descripcion: role.descripcion.value,
                permisos: role.permisos.value,
                status: role.status.value,
                created_at: role.created_at.value,
                created_by: role.created_by.value,
            });
            EntityCache.invalidate(ROLES_NAMESPACE, role.id.value);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    async update(role) {
        await super.update(role);
        EntityCache.invalidate(ROLES_NAMESPACE, role.id.value);
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<null|Role>}
     */
    async find(id) {
        try {
            return await EntityCache.get(
                ROLES_NAMESPACE,
                id.value,
                async () => {
                    const result = await this.read.table('roles').select('*').where({ id: id.value }).first();
                    return !result ? null : new Role(result);
                },
                ROLES_TTL_MS
            );
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async search(criteria) {
        try {
            const result = await criteria.convertToKnex(
                this.read
                    .table('roles')
                    .select(
                        'id',
                        'descripcion',
                        'permisos',
                        'status',
                        'created_at',
                        'updated_at',
                        'created_by',
                        'updated_by',
                        'deleted_by',
                        'deleted_at'
                    )
                    .whereNull('deleted_at')
            );
            return result.map((item) => new Role(item));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts roles matching the criteria. Overrides the base count() to read from the replica.
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('roles').count());
            query.whereNull('roles.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }
}
