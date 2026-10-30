import { CustomError, Helper, KnexRepository } from '../../../shared/index.js';
import { Groups } from '../../index';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexGroupsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'grupos', readerConfig);
    }

    /**
     *
     * @param {object} dto data for insert
     * @returns {Promise<void>}
     */
    async save(dto, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: dto.id.value,
                nombre: dto.nombre.value,
                status: dto.status.value,
                horario_id: dto.horario_id.value,
                descripcion: dto.descripcion.value,
                rol_id: dto.rol_id.value,
                configuration_id: dto.configuration_id.value,
                codigo_externo: dto.codigo_externo.value,
                codigos_externos: dto.codigos_externos.value,
                permisos: dto.permisos.value,
                layouts: dto.layouts.value,
                comportamientos: dto.comportamientos.value,
                filter_order: dto.filter_order.value,
                data: dto.data.value,
                ips_allowed: dto.ips_allowed.value,
                created_by: dto.created_by.value,
                created_at: dto.created_at.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Groups>}
     * @throws {CustomError}
     */
    async find(id) {
        try {
            const result = await this.read.table('grupos').where({ id: id.value }).whereNull('deleted_at').first('*');

            return !result ? null : new Groups(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Groups[]>}
     * @throws {CustomError}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('grupos').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new Groups(row));
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts groups matching the criteria. Overrides the base count() to read from the replica.
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('grupos').count());
            query.whereNull('grupos.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Returns all groups that are status = 1 and not soft-deleted.
     * Used by the worker's `GroupsActionsJob` to evaluate cron-triggered actions.
     *
     * @returns {Promise<Groups[]>}
     */
    async findAllActive() {
        try {
            const rows = await this.table().where('status', 1).whereNull('deleted_at').select('*');
            return rows.map((row) => new Groups(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findAllActive');
        }
    }

    async findActiveByIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        try {
            const rows = await this.table().where('status', 1).whereNull('deleted_at').whereIn('id', ids).select('*');
            return rows.map((row) => new Groups(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findActiveByIds');
        }
    }

    async countActive() {
        try {
            const [{ count }] = await this.table().where('status', 1).whereNull('deleted_at').count('id as count');
            return parseInt(count, 10);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('countActive');
        }
    }

    /**
     * Counts the non-deleted groups that use the schedule. Runs inside `trx` because the result
     * gates the schedule delete.
     * @param {string} horarioId
     * @param {import('knex').Knex.Transaction} trx
     * @returns {Promise<number>}
     */
    async countActiveByHorarioId(horarioId, trx) {
        try {
            const [{ count }] = await this.trxTable(trx)
                .where({ horario_id: horarioId })
                .whereNull('deleted_at')
                .count('id as count');
            return Number(count);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('countActiveByHorarioId');
        }
    }

    async findByIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        try {
            const rows = await this.table().whereNull('deleted_at').whereIn('id', ids).select('*');
            return rows.map((row) => new Groups(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByIds');
        }
    }

    /**
     * Finds work queue groups with their per-user capacity (remaining cases slots).
     *
     * Only groups configured as `cola_de_trabajo` are returned.
     * Each entry includes:
     *   - `capacidad`: total remaining slots across all eligible users.
     *   - `users`: list of `{ id, remaining }` for users that still have capacity.
     *
     * Which users are "eligible" depends on `activeUsers_filter_bool`:
     *   - `true`  → session-active users only (last_seen_at within limit AND grupo_activo matches).
     *   - `false` → all system-active users (is_active = true, regardless of session).
     *
     * When `activeUsers_filter_integration_bool` is enabled, users must also have
     * `last_integration_active_at` within `assignment_active_session_limit` minutes.
     * If both filters are enabled, both conditions are required.
     *
     * @returns {Promise<Array<{
     *   grupo_id: string,
     *   type_assignment: string,
     *   capacidad: number,
     *   work_queue_sorting_rules: Array,
     *   max_cases_per_user: number|undefined,
     *   activeUsers_filter_bool: boolean,
     *   activeUsers_filter_integration_bool: boolean,
     *   assignLastResponsibleIgnoreDefault: boolean|undefined,
     *   users_total: number,
     *   users_available: number,
     *   available_user_ids: string[],
     *   users: Array<{ id: string, remaining: number }>,
     * }>>}
     */
    async findWorkQueueGroupsWithCapacity() {
        try {
            const queryBuilder = this.table(`${this.tableName} as g`)
                .select([
                    'g.id as groupId',
                    'gc.settings as settings',
                    'u.id as userId',
                    'u.last_login_at',
                    'u.last_seen_at',
                    'u.last_integration_active_at',
                    'u.grupo_activo',
                    'u.is_active',
                ])
                .innerJoin(`${this.qualifiedName('global_configurations')} as gc`, 'g.configuration_id', 'gc.id')
                .leftJoin(`${this.qualifiedName('rel_usuarios_grupos')} as rug`, 'g.id', 'rug.grupo_id')
                .leftJoin(`${this.qualifiedName('usuarios')} as u`, function () {
                    this.on('rug.usuario_id', '=', 'u.id').andOnNull('u.deleted_at');
                })
                .whereNull('g.deleted_by')
                .whereNotNull('g.configuration_id');

            queryBuilder.whereRaw(
                "gc.settings->'behaviors'->'application'->'agente'->'casos'->>'type_assignment' = 'cola_de_trabajo'"
            );

            Helper.logDebug('Query WorkQueueGroupsWithCapacity: ' + queryBuilder.toQuery());

            const [rows, userOpenCasesRows] = await Promise.all([
                queryBuilder,
                this.table('cases')
                    .select('grupo_id', 'responsable_id')
                    .count('id as openCasesCount')
                    .whereNull('fecha_resolucion')
                    .whereNull('deleted_at')
                    .whereNotNull('grupo_id')
                    .whereNotNull('responsable_id')
                    .groupBy('grupo_id', 'responsable_id'),
            ]);

            const openCasesByGroupUser = new Map();
            for (const row of userOpenCasesRows) {
                const gKey = String(row.grupo_id);
                const uKey = String(row.responsable_id);
                if (!openCasesByGroupUser.has(gKey)) openCasesByGroupUser.set(gKey, new Map());
                openCasesByGroupUser.get(gKey).set(uKey, parseInt(row.openCasesCount, 10));
            }

            const groupMap = new Map();

            for (const row of rows) {
                const {
                    groupId,
                    settings,
                    userId,
                    last_login_at,
                    last_seen_at,
                    last_integration_active_at,
                    grupo_activo,
                    is_active,
                } = row;

                if (!groupMap.has(groupId)) {
                    const settingsObj = settings || {};

                    const casesConfig = settingsObj?.behaviors?.application?.agente?.casos || {};

                    groupMap.set(groupId, {
                        groupId,
                        config: {
                            ...casesConfig,
                            active_session_limit: casesConfig.assignment_active_session_limit,
                        },
                        activeUserIds: new Set(),
                        integrationActiveUserIds: new Set(),
                        totalUserIds: new Set(),
                        lastLoginByUser: new Map(),
                        _usersSeen: new Set(),
                    });
                }

                const groupData = groupMap.get(groupId);

                if (userId && !groupData._usersSeen.has(userId)) {
                    groupData._usersSeen.add(userId);

                    const userIdKey = String(userId);
                    const rawActiveSessionLimit = groupData.config.active_session_limit;
                    const active_session_limit =
                        Number.isInteger(rawActiveSessionLimit) && rawActiveSessionLimit > 0
                            ? rawActiveSessionLimit
                            : 2;
                    const isSystemActive = String(is_active) === '1' || is_active === true;

                    groupData.lastLoginByUser.set(userIdKey, last_login_at ? new Date(last_login_at).getTime() : null);

                    if (isSystemActive) {
                        groupData.totalUserIds.add(userIdKey);
                    }

                    if (isSystemActive) {
                        const limitDate = new Date(Date.now() - active_session_limit * 60 * 1000);
                        const isSessionRecent = last_seen_at && new Date(last_seen_at) >= limitDate;
                        const isIntegrationRecent =
                            last_integration_active_at && new Date(last_integration_active_at) >= limitDate;
                        const isInActiveGroup = String(grupo_activo) === String(groupId);

                        const sessionActive = isInActiveGroup && isSessionRecent;
                        const integrationActive = isIntegrationRecent;

                        if (sessionActive) {
                            groupData.activeUserIds.add(userIdKey);
                        }
                        if (integrationActive) {
                            groupData.integrationActiveUserIds.add(userIdKey);
                        }

                        Helper.logDebug2('WorkQueueCapacity.user.evaluated', {
                            groupId,
                            userId: userIdKey,
                            activeSessionLimitMin: active_session_limit,
                            limitDate: limitDate.toISOString(),
                            lastSeenAt: last_seen_at ?? null,
                            lastIntegrationActiveAt: last_integration_active_at ?? null,
                            grupoActivo: grupo_activo ?? null,
                            isInActiveGroup,
                            isSessionRecent: Boolean(isSessionRecent),
                            isIntegrationRecent: Boolean(isIntegrationRecent),
                            sessionActive: Boolean(sessionActive),
                            integrationActive: Boolean(integrationActive),
                        });
                    } else {
                        Helper.logDebug2('WorkQueueCapacity.user.skipped', {
                            groupId,
                            userId: userIdKey,
                            reason: 'user_not_system_active',
                        });
                    }
                }
            }

            const result = [];

            for (const group of groupMap.values()) {
                const { groupId, config, activeUserIds, integrationActiveUserIds, totalUserIds, lastLoginByUser } =
                    group;

                const hasMaxCases =
                    config.max_cases_per_user !== undefined &&
                    config.max_cases_per_user !== null &&
                    config.max_cases_per_user !== '';
                const hasActiveUsersFilter =
                    config.activeUsers_filter_bool === true || config.activeUsers_filter_bool === 'true';
                const hasIntegrationActiveUsersFilter =
                    config.activeUsers_filter_integration_bool === true ||
                    config.activeUsers_filter_integration_bool === 'true';

                if (!hasMaxCases && !hasActiveUsersFilter && !hasIntegrationActiveUsersFilter) {
                    Helper.logDebug('WorkQueueCapacity.group.skipped', {
                        groupId,
                        reason: 'no_max_cases_and_no_active_user_filters',
                    });
                    continue;
                }

                const max_cases_per_user = hasMaxCases ? parseInt(config.max_cases_per_user, 10) : undefined;

                let eligibleUserIds = totalUserIds;
                if (hasActiveUsersFilter && hasIntegrationActiveUsersFilter) {
                    eligibleUserIds = new Set(
                        [...activeUserIds].filter((userId) => integrationActiveUserIds.has(userId))
                    );
                } else if (hasActiveUsersFilter) {
                    eligibleUserIds = activeUserIds;
                } else if (hasIntegrationActiveUsersFilter) {
                    eligibleUserIds = integrationActiveUserIds;
                }

                const effectiveActiveSessionLimit =
                    Number.isInteger(config.active_session_limit) && config.active_session_limit > 0
                        ? config.active_session_limit
                        : 2;

                Helper.logDebug('WorkQueueCapacity.group.filters', {
                    groupId,
                    assignmentActiveSessionLimitRaw: config.assignment_active_session_limit ?? null,
                    effectiveActiveSessionLimitMin: effectiveActiveSessionLimit,
                    hasActiveUsersFilter,
                    hasIntegrationActiveUsersFilter,
                    totalUsers: totalUserIds.size,
                    sessionActiveUsers: activeUserIds.size,
                    integrationActiveUsers: integrationActiveUserIds.size,
                    eligibleUsers: eligibleUserIds.size,
                });

                const sortingRules = Array.isArray(config.work_queue_sorting_rules)
                    ? config.work_queue_sorting_rules.filter((r) => r?.assign_strategy && r?.order_type)
                    : [];

                const workQueueSortingRules = sortingRules.length
                    ? sortingRules
                    : config.assign_strategy && config.order_type
                      ? [
                            {
                                assign_strategy: config.assign_strategy,
                                order_type: config.order_type,
                                cast_type: config.cast_type ?? null,
                            },
                        ]
                      : [];

                const users = [];
                let capacidad = 0;

                const openCasesByUser = openCasesByGroupUser.get(String(groupId)) || new Map();

                const orderedUserIds = [...eligibleUserIds].sort((a, b) => {
                    const casesDiff = (openCasesByUser.get(String(a)) || 0) - (openCasesByUser.get(String(b)) || 0);
                    if (casesDiff !== 0) return casesDiff;

                    const loginA = lastLoginByUser.get(String(a));
                    const loginB = lastLoginByUser.get(String(b));
                    if (loginA !== loginB) {
                        if (loginA === null || loginA === undefined) return 1;
                        if (loginB === null || loginB === undefined) return -1;
                        return loginA - loginB;
                    }

                    return String(a).localeCompare(String(b));
                });

                if (hasMaxCases) {
                    for (const userId of orderedUserIds) {
                        const openCases = openCasesByUser.get(String(userId)) || 0;
                        const remaining = max_cases_per_user - openCases;

                        if (remaining > 0) {
                            users.push({ id: userId, remaining });
                            capacidad += remaining;
                        }
                    }
                } else {
                    capacidad = eligibleUserIds.size > 0 ? Number.POSITIVE_INFINITY : 0;
                    for (const userId of orderedUserIds) {
                        users.push({ id: userId, remaining: Number.POSITIVE_INFINITY });
                    }
                }

                const assignLastResponsibleIgnoreDefault =
                    config.assignLastResponsibleIgnoreDefault === true ||
                    config.assignLastResponsibleIgnoreDefault === 'true';

                result.push({
                    grupo_id: groupId,
                    type_assignment: config.type_assignment,
                    capacidad,
                    work_queue_sorting_rules: workQueueSortingRules,
                    max_cases_per_user,
                    activeUsers_filter_bool: hasActiveUsersFilter,
                    activeUsers_filter_integration_bool: hasIntegrationActiveUsersFilter,
                    assignLastResponsibleIgnoreDefault,
                    // Miembros activos del grupo, tengan o no capacidad/sesión: permite
                    // distinguir "grupo sin usuarios" de "usuarios sin capacidad".
                    users_total: totalUserIds.size,
                    // Disponibles (pasan los filtros de sesión/integración) aunque no les
                    // quede cupo: users_available - users.length = disponibles saturados.
                    users_available: eligibleUserIds.size,
                    available_user_ids: [...eligibleUserIds],
                    users,
                });
            }

            return result;
        } catch (error) {
            Helper.logError('Error finding work queue groups with capacity', error);
            throw new QueryDBError('findWorkQueueGroupsWithCapacity');
        }
    }
}
