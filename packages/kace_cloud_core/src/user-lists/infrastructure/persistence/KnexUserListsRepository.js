import { UserList } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const DEFAULT_ASSIGNEE_EXTERNAL_CODE = 'DEFAULT_ASSIGNEE';

export class KnexUserListsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'lista_usuarios', readerConfig);
    }

    /**
     * Save a new UserList to the database.
     *
     * @param {UserList} userList
     * @returns {Promise<void>}
     * @throws {Error} If the operation fails.
     */
    async save(userList) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: userList.id.value,
                descripcion: userList.descripcion.value,
                lista_usuarios: JSON.stringify(userList.lista_usuarios.value),
                is_active: userList.is_active.value,
                group_id: userList.group_id.value,
                created_at: userList.created_at.value,
                updated_at: userList.updated_at.value,
                created_by: userList.created_by.value,
                updated_by: userList.updated_by.value,
                deleted_at: userList.deleted_at.value,
                deleted_by: userList.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving userList:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a UserList by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<UserList | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('lista_usuarios').where({ id: id.value }).first();

            return result ? new UserList(result) : null;
        } catch (error) {
            Helper.logError('Error finding userList:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `UserList` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<UserList[]>} A promise that resolves to an array of `UserList` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('lista_usuarios').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new UserList(row));
        } catch (error) {
            Helper.logError('Error searching userList:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of UserLists based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `UserList` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('lista_usuarios').count());
            query.whereNull(`deleted_at`);

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Find a UserList by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<UserList | null>}
     */
    async findSelectedAdvisor(id, caseId = null) {
        try {
            const connection = this.connection;

            const userList = await this.table()
                .leftJoin(this.qualifiedName('grupos'), 'grupos.id', `${this.tableName}.group_id`)
                .leftJoin(
                    this.qualifiedName('global_configurations'),
                    'global_configurations.id',
                    `grupos.configuration_id`
                )
                .where({ [`${this.tableName}.id`]: id.value })
                .first();

            if (!userList) {
                return null;
            }

            const users = userList.lista_usuarios;
            const userIds = users.map((u) => u.id);
            const targetGroupId = userList.group_id;

            const settings = typeof userList.settings === 'string' ? JSON.parse(userList.settings) : userList.settings;

            const configurations = settings?.behaviors?.application?.agente?.casos;

            const isTypeAssigmentWorkQueue = configurations?.type_assignment === 'cola_de_trabajo';

            const maxCases = configurations?.max_cases_per_user;
            const activeUsers_filter_bool = configurations?.activeUsers_filter_bool;
            const activeUsers_filter_integration_bool = configurations?.activeUsers_filter_integration_bool;
            const assignLastResponsibleIgnoreDefault = configurations?.assignLastResponsibleIgnoreDefault;

            const assignmentActiveSessionLimit = configurations?.assignment_active_session_limit;

            const activeSessionLimit =
                Number.isInteger(assignmentActiveSessionLimit) && assignmentActiveSessionLimit > 0
                    ? assignmentActiveSessionLimit
                    : 2;

            const buildCandidateQuery = () => {
                const query = this.table('usuarios as u')
                    .leftJoin(this.qualifiedName('cases') + ' as c', function () {
                        this.on('c.responsable_id', '=', 'u.id').onNull('c.fecha_resolucion').onNull('c.deleted_at');

                        if (targetGroupId) {
                            this.on('c.grupo_id', '=', connection.raw('?', [targetGroupId]));
                        }
                    })
                    .whereIn('u.id', userIds)
                    .groupBy('u.id', 'u.nombres', 'u.last_login_at', 'u.grupo_activo')
                    .select(
                        'u.id',
                        'u.nombres',
                        'u.last_login_at',
                        'u.grupo_activo',
                        this.connection.raw('COUNT(c.id) as total_cases')
                    );

                if (isTypeAssigmentWorkQueue && maxCases && maxCases > 0) {
                    query.having(this.connection.raw('COUNT(c.id) < ?', [maxCases]));
                }

                if (isTypeAssigmentWorkQueue && activeUsers_filter_bool) {
                    query.whereRaw(`u.last_seen_at >= NOW() - INTERVAL '1 minute' * ?`, [activeSessionLimit]);
                }

                if (isTypeAssigmentWorkQueue && activeUsers_filter_integration_bool) {
                    query.whereRaw(`u.last_integration_active_at >= NOW() - INTERVAL '1 minute' * ?`, [
                        activeSessionLimit,
                    ]);
                }

                query
                    .orderBy('total_cases', 'asc')
                    .orderByRaw('(?? is null)', ['u.last_login_at'])
                    .orderBy('u.last_login_at', 'asc')
                    .orderBy('u.id', 'asc');

                return query;
            };

            if (isTypeAssigmentWorkQueue && assignLastResponsibleIgnoreDefault && caseId) {
                const normalizedCaseId = caseId?.value ?? caseId;
                const prioritizedId = await this.#getPrioritizedCandidateId(normalizedCaseId);

                if (prioritizedId) {
                    const prioritizedCandidate = await buildCandidateQuery().where('u.id', prioritizedId).first();

                    if (prioritizedCandidate) {
                        return prioritizedCandidate;
                    }
                }
            }

            return await buildCandidateQuery().first();
        } catch (error) {
            Helper.logError('Error finding candidate for work queue', error);
            throw new QueryDBError('find');
        }
    }

    async #getPrioritizedCandidateId(caseId) {
        const lastChanges = await this.table('history_cases')
            .select('new_attributes')
            .where({ entity_id: caseId })
            .orderBy('created_at', 'desc');

        if (!lastChanges.length) {
            return null;
        }

        const users = await this.table('usuarios').select('id', 'codigos_externos');

        const defaultAssigneeIds = new Set(
            users
                .filter((user) => {
                    const externalCodes =
                        typeof user.codigos_externos === 'string'
                            ? user.codigos_externos
                            : JSON.stringify(user.codigos_externos ?? '');

                    return externalCodes.toUpperCase().includes(DEFAULT_ASSIGNEE_EXTERNAL_CODE);
                })
                .map((user) => String(user.id))
        );

        for (const change of lastChanges) {
            const candidateId =
                typeof change.new_attributes === 'string'
                    ? JSON.parse(change.new_attributes)?.responsable_id
                    : change.new_attributes?.responsable_id;

            if (!candidateId) {
                continue;
            }

            if (!defaultAssigneeIds.has(String(candidateId))) {
                return candidateId;
            }
        }

        return null;
    }
}
