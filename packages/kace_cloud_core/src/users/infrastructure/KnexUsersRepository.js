import { User } from '../index';
import { Helper, KnexRepository, Criteria } from '../../shared/index';
import dayjs from 'dayjs';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { UserCollectionResponse } from '../index';
import { ValueObjectUserName } from '../domain/ValueObjectUserName.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

const DEFAULT_ASSIGNEE_EXTERNAL_CODE = 'DEFAULT_ASSIGNEE';

export class KnexUsersRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'usuarios', readerConfig);
    }

    /**
     * Saves a new user in the database.
     * @param {User} user
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async save(user, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: user.id.value,
                login: user.login.value,
                nombres: user.nombres.value,
                apellido1: user.apellido1.value,
                apellido2: user.apellido2.value,
                email: user.email.value,
                telefono: user.telefono.value,
                movil: user.movil.value,
                token: user.token.value,
                grupo_activo: user.grupo_activo.value,
                rol_id: user.rol_id.value,
                codigos_externos: user.codigos_externos.value,
                external_id: user.external_id.value,
                grid: user.grid.value,
                filters: user.filters.value,
                data: user.data.value,
                ips_allowed: user.ips_allowed.value,
                is_active: user.is_active.value,
                account_type: user.account_type.value,
                last_seen_at: user.last_seen_at.value,
                last_login_at: user.last_login_at.value,
                last_integration_active_at: user.last_integration_active_at.value,
                created_at: user.created_at.value,
                created_by: user.created_by.value,
                password_encryption_migrated: user.password_encryption_migrated?.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a user by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<User | null>}
     */
    async find(id) {
        try {
            const result = await this.read
                .table()
                .select('usuarios.*', 'roles.permisos as permissions')
                .leftJoin(this.qualifiedName('roles'), 'roles.id', 'usuarios.rol_id')
                .where('usuarios.id', id.value)
                .first();

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logError('Error finding user', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing user.
     * @param {User} user
     * @returns {Promise<void>}
     */
    async update(user) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(user.changedAttributes).where({ id: user.id.value });
        } catch (error) {
            Helper.logError('Error updating user', error);
            throw new QueryDBError('update');
        }
    }

    async bulkUpdateByIds(ids, changes, trx = null) {
        try {
            DbRequestContext.markWrite();
            const query = this.trxTable(trx);
            await query.update(changes).whereIn('id', ids).whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error bulk updating users', error);
            throw new QueryDBError('update');
        }
    }

    async findByIds(ids, trx = null) {
        try {
            const query = this.trxTable(trx)
                .select('usuarios.*')
                .whereIn('usuarios.id', ids)
                .whereNull('usuarios.deleted_at');

            const rows = await query;
            return rows.map((row) => new User(row));
        } catch (error) {
            Helper.logError('Error finding users by ids', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the last seen timestamp for a user session, only if it is stale.
     * The UPDATE affects 0 rows (cheap, no WAL) when `last_seen_at` is newer than `threshold`.
     * @param {string} userId
     * @param {string} timestamp - ISO 8601 "now".
     * @param {string} updatedBy
     * @param {string} threshold - ISO 8601 cutoff; write only if last_seen_at is NULL or older.
     * @returns {Promise<void>}
     */
    async updateLastSeenAt(userId, timestamp, updatedBy, threshold) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    last_seen_at: timestamp,
                    updated_at: timestamp,
                    updated_by: updatedBy,
                })
                .where({ id: userId })
                .andWhere((builder) => builder.whereNull('last_seen_at').orWhere('last_seen_at', '<', threshold));
        } catch (error) {
            Helper.logError('Error updating last_seen_at', error);
            throw new QueryDBError('custom', 'Error updating last_seen_at');
        }
    }

    /**
     * Updates the last integration active timestamp for a user.
     * @param {string} userId
     * @param {string} timestamp
     * @returns {Promise<void>}
     */
    async updateLastIntegrationActiveAt(userId, timestamp) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    last_integration_active_at: timestamp,
                    updated_at: new Date().toISOString(),
                    updated_by: userId,
                })
                .where({ id: userId });
        } catch (error) {
            Helper.logError('Error updating last_integration_active_at', error);
            throw new QueryDBError('updateLastIntegrationActiveAt');
        }
    }

    /**
     * Searches for `User` instances based on the given criteria.
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<User[]>} A promise that resolves to an array of `User` instances matching the criteria.
     */
    async search(criteria, groupIds = null) {
        try {
            Helper.logDebug(`Begin KnexUsersRepository.search at ${new Date().toISOString()}`);
            const query = criteria.convertToKnex(this.read.table().select('*'));
            query.whereNull('deleted_at');
            if (groupIds?.length > 0) {
                const tableName = this.tableName;
                const relGroupsTable = this.qualifiedName('rel_usuarios_grupos');
                query.whereIn(`${tableName}.id`, function () {
                    this.select('usuario_id').from(relGroupsTable).whereIn('grupo_id', groupIds);
                });
            }
            const rows = await query;
            Helper.logDebug(`Query executed ${new Date().toISOString()}`);
            const result = rows.map((row, index) => {
                Helper.logDebug(`Inicia iteracion ${index}: ${new Date().toISOString()}`);
                const user = new User(row);
                Helper.logDebug(`Termina iteracion ${index}: ${new Date().toISOString()}`);
                return user;
            });
            Helper.logDebug(`End KnexUsersRepository.search at ${new Date().toISOString()}`);
            return result;
        } catch (error) {
            Helper.logError('Error searching user', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts users matching raw filters and optionally restricted to a set of group IDs.
     * @param {Array} rawFilters
     * @param {*} relationship
     * @param {string[]|null} groupIds
     * @returns {Promise<Object>}
     */
    async countUsers(rawFilters, relationship, groupIds = null) {
        try {
            const tablename = this.tableName;
            const criteria = new Criteria(rawFilters, relationship, 0, 0, undefined, tablename);
            const query = criteria.convertToKnex(this.table().count());
            query.whereNull(`${tablename}.deleted_at`);
            if (groupIds?.length > 0) {
                const relGroupsTable = this.qualifiedName('rel_usuarios_grupos');
                query.whereIn(`${tablename}.id`, function () {
                    this.select('usuario_id').from(relGroupsTable).whereIn('grupo_id', groupIds);
                });
            }
            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting users by group', error);
            throw new QueryDBError('countUsers');
        }
    }

    /**
     * Fetches groups for multiple users in a single batch query.
     * @param {string[]} userIds
     * @returns {Promise<Map<string, Array<{id: string, nombre: string}>>>}
     */
    async findGroupsByUserIds(userIds) {
        try {
            const rows = await this.read
                .table('rel_usuarios_grupos')
                .select('rel_usuarios_grupos.usuario_id', 'grupos.id', 'grupos.nombre')
                .join(this.qualifiedName('grupos'), 'rel_usuarios_grupos.grupo_id', 'grupos.id')
                .whereIn('rel_usuarios_grupos.usuario_id', userIds)
                .whereNull('grupos.deleted_at');

            const map = new Map();
            for (const row of rows) {
                if (!map.has(row.usuario_id)) map.set(row.usuario_id, []);
                map.get(row.usuario_id).push({ id: row.id, nombre: row.nombre });
            }
            return map;
        } catch (error) {
            Helper.logError('Error fetching groups for users', error);
            throw new QueryDBError('findGroupsByUserIds');
        }
    }

    /**
     * Counts the number of `User` instances that match the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of matching `User` instances.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().count());
            // search() always excludes soft-deleted users, so the total must too.
            query.whereNull(`${this.tableName}.deleted_at`);
            const [row] = await query;
            return row;
        } catch (error) {
            Helper.logError('Error counting users', error);
            throw new QueryDBError('count');
        }
    }

    async findByLogin(login) {
        try {
            const result = await this.table()
                .select('usuarios.*', 'roles.permisos as permissions')
                .leftJoin(this.qualifiedName('roles'), 'roles.id', 'usuarios.rol_id')
                .where({ 'usuarios.login': login.value })
                .whereNull('usuarios.deleted_at')
                .first();

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    async findByLoginAndFingerprint(login, fingerprint) {
        try {
            const result = await this.table()
                .select('usuarios.*', 'roles.permisos as permissions')
                .leftJoin(this.qualifiedName('roles'), 'roles.id', 'usuarios.rol_id')
                .where({
                    'usuarios.login': login.value,
                    'usuarios.cognito_hash_data': fingerprint.value,
                })
                .whereNull('usuarios.deleted_at')
                .first();

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    async getUserByGroupId(groupId) {
        try {
            const result = await this.table('rel_usuarios_grupos')
                .select('usuarios.*')
                .join(this.qualifiedName('usuarios'), 'usuarios.id', 'rel_usuarios_grupos.usuario_id')
                .where({ grupo_id: groupId.value });

            return result ? result.map((row) => new User(row)) : null;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds the best candidate user for work queue assignment in a specific group.
     *
     * @param {string} groupId - The group ID to search candidates in
     * @param {Object} workQueueConfig - Configuration options for the work queue
     * @param {string} caseId - The case ID to search candidates for
     * @returns {Promise<Array>} Array with the best candidate user
     */
    async findCandidateForWorkQueue(groupId, workQueueConfig = {}, caseId = null) {
        //TODO: Validar el uso de este metodo, fue deprecado y reemplazado por findSelectedAdvisor de KnexUserListsRepository
        try {
            const {
                activeUsers_filter_bool = false,
                max_cases_per_user = null,
                oldestLogin_filter_bool = true,
                activeUsers_filter_integration_bool,
                active_session_limit = 2,
                assignLastResponsibleIgnoreDefault = false,
            } = workQueueConfig;

            const activeCaseCountQuery = this.table('cases')
                .select(['responsable_id as userId', this.connection.raw('COUNT(*) as caseCount')])
                .where('grupo_id', groupId)
                .whereNull('fecha_resolucion')
                .whereNull('deleted_at')
                .groupBy('responsable_id');

            const eligibleUsersQuery = this.table('rel_usuarios_grupos as userGroups')
                .select([
                    'userGroups.usuario_id as userId',
                    'users.last_login_at as lastLoginAt',
                    'users.last_seen_at as lastSeenAt',
                    'users.codigos_externos as codigos_externos',
                ])
                .join(`${this.qualifiedName('usuarios')} as users`, 'users.id', 'userGroups.usuario_id')
                .where('userGroups.grupo_id', groupId)
                .where('users.is_active', '1')
                .whereNull('users.deleted_at')
                .whereNull('users.deleted_by');

            if (activeUsers_filter_bool) {
                eligibleUsersQuery.whereRaw(`users.last_seen_at >= NOW() - INTERVAL '1 minute' * ?`, [
                    active_session_limit,
                ]);

                eligibleUsersQuery.where('users.grupo_activo', groupId);
            }

            if (activeUsers_filter_integration_bool) {
                eligibleUsersQuery.whereRaw(`users.last_integration_active_at >= NOW() - INTERVAL '1 minute' * ?`, [
                    active_session_limit,
                ]);
            }

            const mainQuery = this.connection
                .with('active_case_counts', activeCaseCountQuery)
                .with('eligible_users', eligibleUsersQuery)
                .select([
                    'eligibleUsers.userId as responsable_id',
                    this.connection.raw('COALESCE(casecounts.caseCount, 0) as casos'),
                    'eligibleUsers.lastLoginAt as last_login_at',
                ])
                .from('eligible_users as eligibleUsers')
                .leftJoin('active_case_counts as casecounts', 'casecounts.userId', 'eligibleUsers.userId'); // audit:cte — active_case_counts is a CTE defined above (.with)

            if (max_cases_per_user !== null && max_cases_per_user !== undefined) {
                mainQuery.whereRaw('COALESCE(casecounts.caseCount, 0) < ?', [max_cases_per_user]);
            }

            if (assignLastResponsibleIgnoreDefault && caseId) {
                const prioritizedId = await this.#getPrioritizedCandidateId(caseId);

                if (prioritizedId) {
                    const prioritizedQuery = mainQuery.clone();
                    prioritizedQuery.where('eligibleUsers.userId', prioritizedId);
                    prioritizedQuery.limit(1);

                    Helper.logDebug('Query PrioritizedCandidate: ' + prioritizedQuery.toQuery());

                    const prioritizedCandidate = await prioritizedQuery;

                    if (prioritizedCandidate.length) {
                        return prioritizedCandidate;
                    }
                }
            }

            mainQuery.orderBy('casos', 'asc');

            if (oldestLogin_filter_bool) {
                mainQuery.orderByRaw('(?? is null)', ['eligibleUsers.lastLoginAt']);
                mainQuery.orderBy('eligibleUsers.lastLoginAt', 'asc');
            }

            mainQuery.orderBy('eligibleUsers.userId', 'asc');

            mainQuery.limit(1);

            Helper.logDebug('Query CandidateForWorkQueue: ' + mainQuery.toQuery());

            return await mainQuery;
        } catch (error) {
            Helper.logError('Error finding candidate for work queue', error);
            throw new QueryDBError('find');
        }
    }

    async #getPrioritizedCandidateId(caseId) {
        const defaultAssigneePattern = `%${DEFAULT_ASSIGNEE_EXTERNAL_CODE}%`;

        const lastChange = await this.table('history_cases')
            .select('new_attributes')
            .where({ entity_id: caseId })
            .whereRaw(`changed_attributes->>'responsable_id' IS NOT NULL`)
            .whereRaw(
                `(changed_attributes->>'responsable_id') NOT IN (
                        SELECT id::text
                        FROM usuarios
                        WHERE COALESCE(codigos_externos::text, '') ILIKE ?
                    )`,
                [defaultAssigneePattern]
            )
            .orderBy('created_at', 'desc')
            .first();

        if (!lastChange?.new_attributes) {
            return null;
        }

        const parseJson = (value) => {
            if (!value) return null;
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            }
            return value;
        };

        return parseJson(lastChange.new_attributes)?.responsable_id ?? null;
    }

    async findByGroupForEquivalentAssignment(grupoId) {
        try {
            return await this.table('rel_usuarios_grupos')
                .select([
                    'rel_usuarios_grupos.usuario_id as responsable_id',
                    this.connection.raw('count(c.id) as casos'),
                ])
                .join(`${this.qualifiedName('usuarios')} as u`, 'u.id', 'rel_usuarios_grupos.usuario_id')
                .leftJoin(`${this.qualifiedName('cases')} as c`, function () {
                    const todayStart = dayjs().startOf('day').toISOString();
                    const todayEnd = dayjs().endOf('day').toISOString();
                    this.on('c.responsable_id', '=', 'rel_usuarios_grupos.usuario_id').andOnBetween('c.created_at', [
                        todayStart,
                        todayEnd,
                    ]);
                })
                .where('rel_usuarios_grupos.grupo_id', grupoId)
                .andWhere('u.is_active', '1')
                .whereNull('u.deleted_at')
                .whereNull('u.deleted_by')
                .groupBy('rel_usuarios_grupos.usuario_id', 'c.responsable_id')
                .orderBy('casos', 'asc');
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Returns all users that are active (`is_active = '1'`) and not soft-deleted.
     * Used by the worker's `UsersActionsJob` to evaluate cron-triggered actions.
     *
     * @returns {Promise<User[]>}
     */
    async findAllActive() {
        try {
            const rows = await this.table().where('is_active', '1').whereNull('deleted_at').select('*');
            return rows.map((row) => new User(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findAllActive');
        }
    }

    /**
     * Returns active (`is_active='1'`, not soft-deleted) users matching the given IDs.
     * @param {string[]} ids
     * @returns {Promise<User[]>}
     */
    async findActiveByIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        try {
            const rows = await this.table()
                .where('is_active', '1')
                .whereNull('deleted_at')
                .whereIn('id', ids)
                .select('*');
            return rows.map((row) => new User(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findActiveByIds');
        }
    }

    /**
     * Applies filters for users present in an active group within the session window.
     * @param {import('knex').Knex.QueryBuilder} query
     * @param {string} groupId
     * @param {number} activeSessionLimitMinutes
     * @returns {import('knex').Knex.QueryBuilder}
     */
    #applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes) {
        query.where('grupo_activo', groupId).whereNull('deleted_at').whereNotNull('last_seen_at');

        query.whereRaw(`last_seen_at >= NOW() - INTERVAL '1 minute' * ?`, [activeSessionLimitMinutes]);
        return query;
    }

    /**
     * Counts non-deleted users whose `grupo_activo` references the given group
     * and whose `last_seen_at` falls within the active session window.
     * @param {string} groupId
     * @param {number} activeSessionLimitMinutes
     * @returns {Promise<number>}
     */
    async countByActiveGroup(groupId, activeSessionLimitMinutes) {
        try {
            const query = this.table().count('id as count');
            this.#applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes);
            const [{ count }] = await query;
            return parseInt(count, 10);
        } catch (error) {
            Helper.logError('Error counting users by active group', error);
            throw new QueryDBError('countByActiveGroup');
        }
    }

    /**
     * Lists non-deleted users whose `grupo_activo` references the given group
     * and whose `last_seen_at` falls within the active session window.
     * @param {string} groupId
     * @param {number} activeSessionLimitMinutes
     * @returns {Promise<Array<{ nombres: string, apellido1: string, apellido2: string|null, email: string }>>}
     */
    async listByActiveGroup(groupId, activeSessionLimitMinutes) {
        try {
            const query = this.table().select('nombres', 'apellido1', 'apellido2', 'email');
            this.#applyActiveGroupPresenceFilter(query, groupId, activeSessionLimitMinutes);
            return await query
                .orderByRaw('LOWER(nombres) ASC')
                .orderByRaw('LOWER(apellido1) ASC')
                .orderByRaw('LOWER(email) ASC');
        } catch (error) {
            Helper.logError('Error listing users by active group', error);
            throw new QueryDBError('listByActiveGroup');
        }
    }

    /**
     * Counts active (`is_active='1'`, not soft-deleted) users.
     * @returns {Promise<number>}
     */
    async countActive() {
        try {
            const [{ count }] = await this.table().where('is_active', '1').whereNull('deleted_at').count('id as count');
            return parseInt(count, 10);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('countActive');
        }
    }

    /**
     * Searches for `User` instances based on the given criteria.
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<User[]>} A promise that resolves to an array of `User` instances matching the criteria.
     */
    async searchByName(data) {
        const name = new ValueObjectUserName('userName', data.name);
        try {
            Helper.logDebug(`Begin KnexUsersRepository.searchByName at ${new Date().toISOString()}`);
            const query = this.read
                .table()
                .select('*')
                .where(function () {
                    this.where('nombres', 'ilike', `%${name.value}%`)
                        .orWhere('apellido1', 'ilike', `%${name.value}%`)
                        .orWhere('apellido2', 'ilike', `%${name.value}%`);
                })
                .whereNull('deleted_at');

            const rows = await query;
            Helper.logDebug(`Query executed ${new Date().toISOString()}`);
            const result = rows.map((row, index) => {
                Helper.logDebug(`Inicia iteracion ${index}: ${new Date().toISOString()}`);
                const user = new User(row);
                Helper.logDebug(`Termina iteracion ${index}: ${new Date().toISOString()}`);
                return user;
            });
            Helper.logDebug(`End KnexUsersRepository.searchByName at ${new Date().toISOString()}`);
            return new UserCollectionResponse(result, result.length);
        } catch (error) {
            Helper.logError('Error searching user by name', error);
            throw new QueryDBError('searchByName');
        }
    }
}
