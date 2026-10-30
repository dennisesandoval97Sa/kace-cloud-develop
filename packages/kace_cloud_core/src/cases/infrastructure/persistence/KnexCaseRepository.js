import { v4 as uuidV4 } from 'uuid';
import {
    CustomError,
    EntityCache,
    Helper,
    InvalidArgumentError,
    KnexRepository,
    StatusEnum,
} from '../../../shared/index.js';
import { Case, CaseAvailableStates, CaseDataGrid, CaseTransitions } from '../../index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { ShiftManagement } from '../../../shift-management/index.js';
import { Ans } from '../../../ans/index.js';
import { ValueObjectUuid } from '../../../shared/index.js';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';
import { trimAuxData, AUX_BUDGET_BYTES } from '../../../shared/domain/trimAuxData.js';
import { STALE_FIELDS } from '../../domain/staleFields.js';

const CASES_COUNT_NAMESPACE = 'cases:count';
const CASES_SEARCH_COUNT_NAMESPACE = 'cases:searchCount';
const CASES_COUNT_BY_STATUS_NAMESPACE = 'cases:countByStatus';
const CASES_COUNT_TTL_MS = 30_000;

// All columns that `bulkUpdateSlaTimers` is allowed to write. Keys must match the names
// produced by `Case` setters in `changedAttributes`. Whitelisted to prevent injection of
// arbitrary column names from the aggregate.
const SLA_UPDATABLE_COLUMNS = Object.freeze([
    'antiguedad',
    'ans_posicion',
    'antiguedad_dias',
    'antiguedad_horas',
    'antiguedad_minutos',
    'sla_position',
    'sla_elapsed_time',
    'sla_elapsed_days',
    'sla_elapsed_hours',
    'sla_elapsed_minutes',
    'expired_at',
    'sla_due_date',
    'remaining_time',
    'sla_remaining_time',
    'sla_remaining_days',
    'sla_remaining_hours',
    'sla_remaining_minutes',
    'state_elapsed_time',
    'state_elapsed_days',
    'state_elapsed_hours',
    'state_elapsed_minutes',
    'sla_state_elapsed_time',
    'sla_state_elapsed_days',
    'sla_state_elapsed_hours',
    'sla_state_elapsed_minutes',
    'sla_state_position',
    'sla_state_due_date',
    'sla_state_remaining_time',
    'sla_state_remaining_days',
    'sla_state_remaining_hours',
    'sla_state_remaining_minutes',
]);

const STALE_SNAPSHOT_COLUMNS = Object.freeze(STALE_FIELDS.map(({ field }) => field));

// Stays well below the ~65k Postgres parameter limit (1000 rows × 24 cols ≈ 24,000 binds).
const SUB_BATCH_SIZE = 2500;

// Cache key intentionally captures only filters + relationship + tablename: those are the
// inputs that affect the result of `count(criteria)` for the callers in this codebase
// (CaseAnsCounter and CaseSearcher pagination). select/groupBy/having/distinct are NOT
// included; if a future caller passes a Criteria with those fields the cache may return
// stale values — extend this helper before doing so.
function buildCountCacheKey(criteria) {
    const filters = criteria?.filters?.toJson?.() ?? null;
    const relationship = criteria?.relationship?.map?.((r) => r?.toPrimitives?.() ?? r) ?? null;
    const tablename = criteria?.tablename ?? null;
    return JSON.stringify({ f: filters, r: relationship, t: tablename });
}

function invalidateCaseCountCaches() {
    EntityCache.invalidateNamespace(CASES_COUNT_NAMESPACE);
    EntityCache.invalidateNamespace(CASES_SEARCH_COUNT_NAMESPACE);
    EntityCache.invalidateNamespace(CASES_COUNT_BY_STATUS_NAMESPACE);
}

export class KnexCaseRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'cases', readerConfig);
    }

    /**
     * Subconsulta que resuelve `cases.estado_id` a partir de una transición (MSKT-1392 / CORE-0b).
     *
     * `estado_id` es un dato denormalizado: replica `transiciones.siguiente_estado_id` de la
     * transición del caso. Resolverlo aquí —y no en el agregado o en cada caso de uso— es lo
     * que hace el invariante indivisible: la derivación viaja DENTRO de la misma sentencia que
     * escribe `transicion_id`, así que ningún camino puede escribir una sin la otra, ni siquiera
     * el bulk, que no pasa por `Case`. Además ninguno de los casos de uso que mueven la
     * transición tiene garantizado un repositorio de transiciones con el que consultarla
     * (`CaseUpdater` lo recibe opcional y llega en `null` en la mayoría de llamadores).
     *
     * Se expresa como subconsulta correlacionada —igual que el backfill de
     * `20260914125000_backfill_cases_estado_id.js`— para que compile igual en PostgreSQL y en
     * SQLite. Una transición sin siguiente estado resuelve a NULL, que es exactamente lo que
     * hoy muestran las vistas para esos casos.
     *
     * @param {string|null|undefined} transicionId
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {import('knex').Knex.QueryBuilder|null} subconsulta, o null si no hay transición
     */
    #estadoIdFromTransition(transicionId, trx) {
        if (!transicionId) {
            return null;
        }

        return (trx ?? this.connection)(this.qualifiedName('transiciones'))
            .select('siguiente_estado_id')
            .where({ id: transicionId });
    }

    /**
     * Añade `estado_id` al UPDATE cuando la transición cambia.
     *
     * Se extiende `updateValues` y no `update()`: el ciclo de escritura —`markWrite()`, el
     * manejo de errores y el `deleted_at IS NULL`— se queda íntegro en `KnexRepository`, así
     * que un cambio futuro en la base también rige para el caso. Esta es la vía por la que
     * pasan la actualización normal, el cierre y las acciones automatizadas.
     *
     * La derivación NO se inyecta en `changedAttributes`: ese objeto se serializa tal cual en
     * `history_cases.changed_attributes`, y meterle una subconsulta dejaría basura en el
     * histórico. Si el llamador ya fijó `estado_id` explícitamente (la reclasificación), su
     * valor manda y no se deriva nada.
     *
     * @param {Case} aggregate
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Object}
     */
    updateValues(aggregate, trx) {
        const changedAttributes = super.updateValues(aggregate, trx);
        if (changedAttributes.transicion_id === undefined || changedAttributes.estado_id !== undefined) {
            return changedAttributes;
        }

        return {
            ...changedAttributes,
            estado_id: this.#estadoIdFromTransition(changedAttributes.transicion_id, trx),
        };
    }

    /**
     *
     * @param {Case} kase
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction; when provided the
     *   INSERT runs on the transactional connection so it is atomic with the caller's other writes.
     */
    async save(kase, trx) {
        try {
            const result = await (trx ? this.trxTable(trx) : this.table())
                .insert({
                    id: kase.id.value,
                    cliente_id: kase.cliente_id.value,
                    transicion_id: kase.transicion_id.value,
                    estado_id: kase.estado_id.value ?? this.#estadoIdFromTransition(kase.transicion_id.value, trx),
                    responsable_id: kase.responsable_id.value,
                    clasificacion_id: kase.clasificacion_id.value,
                    descripcion_caso_id: kase.descripcion_caso_id.value,
                    cambio_estado_comentario_id: kase.cambio_estado_comentario_id.value,
                    caso_clonado_id: kase.caso_clonado_id.value,
                    grupo_id: kase.grupo_id.value,
                    fecha_resolucion: kase.fecha_resolucion.value,
                    antiguedad: kase.antiguedad.value,
                    ans_posicion: kase.ans_posicion.value,
                    antiguedad_dias: kase.antiguedad_dias.value,
                    antiguedad_horas: kase.antiguedad_horas.value,
                    antiguedad_minutos: kase.antiguedad_minutos.value,
                    motivo_baja: kase.motivo_baja.value,
                    alto_impacto: kase.alto_impacto.value,
                    vista: kase.vista.value,
                    cambio_clasificacion: kase.cambio_clasificacion.value,
                    cloned_by: kase.cloned_by.value,
                    cloned_at: kase.cloned_at.value,
                    reopen_at: kase.reopen_at.value,
                    reopen_by: kase.reopen_by.value,
                    created_at: kase.created_at.value,
                    updated_at: kase.updated_at.value,
                    created_by: kase.created_by.value,
                    updated_by: kase.updated_by.value,
                    edited_by: kase.edited_by.value,
                    edited_at: kase.edited_at.value,
                    state_change_at: kase.state_change_at.value,
                    state_elapsed_days: kase.state_elapsed_days.value,
                    state_elapsed_hours: kase.state_elapsed_hours.value,
                    state_elapsed_minutes: kase.state_elapsed_minutes.value,
                    state_elapsed_time: kase.state_elapsed_time.value,
                    external_code: kase.external_code.value,
                    folio: kase.folio.value,
                    sla_id: kase.sla_id.value,
                    sla_state_id: kase.sla_state_id.value,
                    sla_due_date: kase.sla_due_date.value,
                    parent_id: kase.parent_id.value,
                    is_visible: kase.is_visible.value,
                    last_assigned_at: kase.last_assigned_at.value,
                    first_view_at: kase.first_view_at.value,
                    update_source: kase.update_source.value,
                    assignment_change_type: kase.assignment_change_type.value,
                })
                .returning('*');
            invalidateCaseCountCaches();
            return result ? new Case(result[0]) : null;
        } catch (error) {
            KnexCaseRepository.#rethrowDuplicatedFolio(error, kase);
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     * A folio collision means the unique index caught something the counter should have
     * prevented. Surface it as a 400 naming the field instead of a 500, so the caller does
     * not retry blindly into the same wall.
     *
     * @param {Error} error
     * @param {Case} kase
     */
    static #rethrowDuplicatedFolio(error, kase) {
        if (error?.code === '23505' && String(error?.constraint) === 'idx_cases_folio_unique') {
            Helper.logError('Duplicated folio rejected by idx_cases_folio_unique', error);
            throw new ValidationFailError(`El folio ${kase?.folio?.value} ya existe`, 'folio');
        }
    }

    /**
     * Adds to `update()` the duplicated-folio translation that save() already does.
     * Reclassification assigns a folio through that path, so without it a collision
     * surfaces as a 500.
     *
     * @param {Error} error
     * @param {Case} kase
     */
    translateWriteError(error, kase) {
        KnexCaseRepository.#rethrowDuplicatedFolio(error, kase);
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Case>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();
            return result ? new Case(result) : null;
        } catch (error) {
            Helper.logError('Error  finding  case', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Case|null>}
     */
    async findReadOnly(id) {
        try {
            const result = await this.read.table().where({ id: id.value }).first();
            return result ? new Case(result) : null;
        } catch (error) {
            // Mensaje propio: el fallo de la lectura por réplica no se diagnostica igual que el
            // de `find()`, que va contra el escritor.
            Helper.logError('Error finding case from the reader pool', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {ValueObjectInt} reference
     * @returns {Promise<Case>}
     */
    async findByReference(reference) {
        try {
            const result = await this.table().where({ reference: reference.value }).first();
            return result ? new Case(result) : null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a case by its description ID.
     *
     * @param {import('../../../shared').ValueObjectUuid} descriptionId - The ID of the case description to search for.
     * @returns {Promise<Case|null>} Returns a Case instance if found, otherwise null.
     * @throws {QueryDBError} Throws an error if the query fails.
     */
    async findByDescriptionId(descriptionId) {
        try {
            const result = await this.table().where('descripcion_caso_id', descriptionId.value).first();
            return result ? new Case(result) : null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Counts the number of cases created in the current day based on the tenant's timezone,
     * optionally matching a specific external_code pattern.
     * @param {string|null} pattern - The LIKE pattern to match (e.g., 'M20260118%').
     * @returns {Promise<number>}
     */
    async countCreatedToday(pattern = null) {
        try {
            const dayjs = createDayjsInstance({});
            const startOfDay = dayjs().startOf('day').toISOString();
            const endOfDay = dayjs().endOf('day').toISOString();

            const query = this.table().whereBetween('created_at', [startOfDay, endOfDay]);

            if (pattern) {
                query.where('external_code', 'like', pattern);
            }

            const result = await query.count('id as count').first();

            return parseInt(result.count, 10);
        } catch (error) {
            Helper.logError('Error counting cases created today', error);
            throw new QueryDBError('count');
        }
    }

    /**
     *
     * @param {object} criteria object criteria for search case
     * @returns {Promise<CaseDataGrid[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.#readTable().select(this.#addSelectFields());

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('cases.deleted_at');

            const rows = await this.#addRelationships(queryBuilder);

            return rows.map((row) => new CaseDataGrid(row));
        } catch (error) {
            Helper.logError('Error searching for case', error);
            throw new QueryDBError('search');
        }
    }

    async searchPlain(criteria) {
        try {
            const qb = this.#readTable().select('id');
            criteria.convertToKnex(qb);
            qb.whereNull('cases.deleted_at');

            const rows = await qb;
            return rows;
        } catch (error) {
            Helper.logError('Error searching (plain) for case', error);
            throw new QueryDBError('search');
        }
    }

    async searchWithAllRelations(criteria) {
        try {
            const baseRows = await this.searchPlain(criteria);
            if (!baseRows.length) return [];

            const enriched = [];
            for (const row of baseRows) {
                const idVO = new ValueObjectUuid('case_id', row.id);
                const full = await this.getCaseInformationWithAllRelations(idVO);

                enriched.push({ ...row, ...full });
            }

            return enriched;
        } catch (error) {
            Helper.logError('Error searching (with all relations) for case', error);
            throw new QueryDBError('search');
        }
    }

    /**
     *
     * @param {object} filters object filters for findAllMatchingCondition case
     * @param {object} [options]
     * @param {Array} [options.work_queue_sorting_rules]
     * @returns {Promise<Case[]>}
     */
    async findAllMatchingCondition(filters, options = {}) {
        try {
            const sortingRules = this.#resolveSortingRules(options?.work_queue_sorting_rules);
            const query = this.#readTable().select('cases.*').where(filters).whereNull('cases.deleted_at');

            if (Array.isArray(options?.restrictToIds) && options.restrictToIds.length > 0) {
                query.whereIn('cases.id', options.restrictToIds);
            }

            const needsAuxJoin = sortingRules.some((r) => r.assign_strategy?.toLowerCase().startsWith('aux_cases.'));
            if (needsAuxJoin) {
                query.leftJoin(this.qualifiedName('aux_cases'), `${this.tableName}.id`, 'aux_cases.caso_id');
            }

            this.#applySortingRules(query, sortingRules);
            Helper.logDebug('Query generated for findAllMatchingCondition String', { query: query.toString() });
            const results = await query;
            return results ? results.map((result) => new Case(result)) : [];
        } catch (error) {
            Helper.logError('Error finding all case matching with condition', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Returns only the ids of active cases matching `filters`, ordered by the given
     * work_queue_sorting_rules (with a deterministic cases.id tie-breaker), limited to
     * `options.limit`. Used by the assignment tick to cap how many candidates get hydrated
     * (entities + bulk context) per action, keeping the worker heap bounded on large backlogs.
     * Projects cases.id only — never hydrates Case entities.
     *
     * @param {object} filters object filters for findOrderedIdsMatchingCondition
     * @param {object} [options]
     * @param {string[]} [options.restrictToIds]
     * @param {Array} [options.work_queue_sorting_rules]
     * @param {number} [options.limit]
     * @returns {Promise<string[]>}
     */
    async findOrderedIdsMatchingCondition(filters, options = {}) {
        try {
            if (Array.isArray(options?.restrictToIds) && options.restrictToIds.length === 0) {
                return [];
            }

            const sortingRules = this.#resolveSortingRules(options?.work_queue_sorting_rules);
            const query = this.#readTable().select('cases.id').where(filters).whereNull('cases.deleted_at');

            if (Array.isArray(options?.restrictToIds) && options.restrictToIds.length > 0) {
                query.whereIn('cases.id', options.restrictToIds);
            }

            const needsAuxJoin = sortingRules.some((r) => r.assign_strategy?.toLowerCase().startsWith('aux_cases.'));
            if (needsAuxJoin) {
                query.leftJoin(this.qualifiedName('aux_cases'), `${this.tableName}.id`, 'aux_cases.caso_id');
            }

            this.#applySortingRules(query, sortingRules);
            query.orderBy('cases.id', 'asc');

            if (Number.isInteger(options?.limit) && options.limit > 0) {
                query.limit(options.limit);
            }

            const rows = await query;
            return rows ? rows.map((row) => row.id) : [];
        } catch (error) {
            Helper.logError('Error finding ordered case ids matching with condition', error);
            throw new QueryDBError('find');
        }
    }

    #resolveSortingRules(workQueueSortingRules) {
        if (!Array.isArray(workQueueSortingRules)) {
            return [];
        }

        return workQueueSortingRules.filter((r) => r?.assign_strategy && r?.order_type);
    }

    /**
     * Applies work_queue_sorting_rules as ORDER BY clauses on the given query.
     * Extracted from findAllMatchingCondition so the ordering can be reused by
     * findOrderedIdsMatchingCondition (top-N id projection). Behavior is identical
     * to the previous inline loop; callers add their own tie-breaker/limit.
     */
    #applySortingRules(query, sortingRules) {
        const ASSIGN_EQUIVALENCE = { case_ans: 'sla_due_date' };
        const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

        for (const { assign_strategy, order_type, cast_type } of sortingRules) {
            const normalizedType = String(order_type || 'ASC')
                .trim()
                .toUpperCase();
            const direction = normalizedType.startsWith('DESC') ? 'desc' : 'asc';
            const nullsClause = normalizedType.includes('NULLS')
                ? normalizedType.slice(normalizedType.indexOf('NULLS'))
                : null;

            const applyOrder = (expression) => {
                const nullPart = nullsClause ? ` ${nullsClause}` : '';
                query.orderByRaw(`${expression} ${direction}${nullPart}`);
            };

            if (assign_strategy.toLowerCase().startsWith('aux_cases.')) {
                const jsonPath = assign_strategy.split('.').slice(1);

                if (!jsonPath.every((segment) => SAFE_IDENTIFIER.test(segment))) {
                    Helper.logError(
                        `Skipping unsafe aux_cases assign_strategy in work_queue_sorting_rules: ${assign_strategy}`
                    );
                    continue;
                }

                const raw =
                    jsonPath.length === 1
                        ? `aux_cases.data ->> '${jsonPath[0]}'`
                        : `aux_cases.data ->'${jsonPath.slice(0, -1).join("'->'")}' ->> '${jsonPath.at(-1)}'`;

                const CAST_EXPRESSIONS = {
                    int: (r) => `(${r})::bigint`,
                    date: (r) => `(${r})::timestamp`,
                    epoch: (r) => `TO_TIMESTAMP((${r})::bigint / 1000)`,
                };
                const castFn = CAST_EXPRESSIONS[cast_type] ?? ((r) => r);
                applyOrder(castFn(raw));
                continue;
            }

            const resolved = ASSIGN_EQUIVALENCE[assign_strategy] ?? assign_strategy;

            // Reject anything that is not a bare identifier: `applyOrder` interpolates the column
            // straight into orderByRaw, so this is the same defense-in-depth the aux_cases branch applies.
            if (!SAFE_IDENTIFIER.test(resolved)) {
                Helper.logError(`Skipping unsafe assign_strategy in work_queue_sorting_rules: ${assign_strategy}`);
                continue;
            }

            // Qualify with the base table: `cases` is left-joined to `aux_cases`, and shared columns
            // (created_at, updated_at, deleted_at, id, ...) are otherwise ambiguous once the join is present.
            const column = `${this.tableName}.${resolved}`;

            if (!nullsClause) {
                query.orderBy(column, direction);
                continue;
            }

            applyOrder(column);
        }
    }

    async searchCount(criteria) {
        try {
            return await EntityCache.get(
                CASES_SEARCH_COUNT_NAMESPACE,
                buildCountCacheKey(criteria),
                async () => {
                    const queryBuilder = this.#readTable()
                        .whereNull(`${this.tableName}.deleted_at`)
                        .count({ count: '*' });

                    criteria.convertToKnex(queryBuilder);

                    const query = this.#addRelationships(queryBuilder);

                    const [count] = await query;
                    return count;
                },
                CASES_COUNT_TTL_MS
            );
        } catch (error) {
            Helper.logError('Error counting cases', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts cases grouped by status (estado) applying the given criteria.
     * @param {Criteria} criteria - The criteria to filter cases.
     * @returns {Promise<Array<{status: string, count: number, color: string|null}>>} - Array of objects with status name, count and color.
     */
    async searchCountByStatus(criteria) {
        try {
            return await EntityCache.get(
                CASES_COUNT_BY_STATUS_NAMESPACE,
                buildCountCacheKey(criteria),
                async () => {
                    const queryBuilder = this.#readTable()
                        .select('estados.nombre as status', 'estados.color as color')
                        .count(`${this.tableName}.id as count`)
                        .whereNull(`${this.tableName}.deleted_at`);
                    criteria.convertToKnex(queryBuilder);

                    const queryWithRelations = this.#addRelationships(queryBuilder);

                    queryWithRelations.groupBy('estados.nombre', 'estados.color');

                    const rows = await queryWithRelations;
                    return rows.map((row) => ({
                        status: row.status,
                        count: parseInt(row.count, 10),
                        color: row.color ?? null,
                    }));
                },
                CASES_COUNT_TTL_MS
            );
        } catch (error) {
            Helper.logError('Error counting cases by status', error);
            throw new QueryDBError('count');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id identificator case for fetch all transitions
     * @returns {Promise<CaseTransitions[]>}
     */
    async findTransitionsByCaseId(id) {
        try {
            const query = this.read
                .table('history_cases')
                .select('original_attributes', 'new_attributes', 'changed_attributes')
                .where({ entity_id: id.value })
                .orderBy('created_at', 'asc');

            const historyCase = await query;

            if (historyCase.length === 0) {
                return null;
            }

            return await this.#transformHistoryToTransitions(historyCase);
        } catch (error) {
            Helper.logError('Error finding transitions', error);
            throw new QueryDBError('find');
        }
    }

    async casesCounter(filters = {}) {
        try {
            const casesConfig = [
                { column: 'ans_posicion', condition: 'ans_posicion IN (1,2)', alias: 'toOvercome' },
                { column: 'ans_posicion', condition: 'ans_posicion = 3', alias: 'defeated' },
                { column: 'fecha_resolucion', condition: 'fecha_resolucion IS NOT NULL', alias: 'managed' },
                { column: 'fecha_resolucion', condition: 'fecha_resolucion IS NULL', alias: 'pending' },
            ];
            return await this.getAggregatedStats(casesConfig, filters);
        } catch (error) {
            Helper.logError('Error counting cases', error);
            throw new QueryDBError('count');
        }
    }

    async casesCounterByGroup(filters = {}) {
        try {
            const gruposColumns = { name: 'nombre' };
            return await this.getCountsByStatus('grupos', gruposColumns, 'grupo_id', filters);
        } catch (error) {
            Helper.logError('Error counting cases by group', error);
            throw new QueryDBError('count');
        }
    }

    async casesCounterByResponsible(filters = {}) {
        try {
            const usuariosColumns = { name: 'nombres', last_name: 'apellido1' };
            return await this.getCountsByStatus('usuarios', usuariosColumns, 'responsable_id', filters);
        } catch (error) {
            Helper.logError('Error counting cases by responsable', error);
            throw new QueryDBError('count');
        }
    }

    async getCountsByStatus(tableName, tableColumns, foreignKey, filters = {}) {
        if (typeof filters !== 'object' || filters === null) {
            throw new InvalidArgumentError('El parámetro filters debe ser un objeto válido');
        }
        try {
            const estados = await this.table('estados').select('id', 'nombre').whereNull('deleted_by');

            const estadosMap = estados.reduce((map, estado) => {
                map[estado.id] = estado.nombre;
                return map;
            }, {});

            const entityNameColumn = tableColumns.last_name
                ? this.connection.raw("CONCAT(??.??, ' ', ??.??) as entity_name", [
                      tableName,
                      tableColumns.name,
                      tableName,
                      tableColumns.last_name,
                  ])
                : this.connection.raw('??.?? as entity_name', [tableName, tableColumns.name]);
            const estadoIdColumn = this.connection.raw(
                'COALESCE(transiciones.siguiente_estado_id, transiciones.estado_actual_id) as estado_id'
            );

            const countCasosQuery = this.table(tableName)
                .leftJoin(
                    this.qualifiedName('cases'),
                    this.connection.raw('??.?? = ??.??', [tableName, 'id', 'cases', foreignKey])
                )
                .leftJoin(this.qualifiedName('transiciones'), 'cases.transicion_id', 'transiciones.id')
                .leftJoin(this.qualifiedName('estados'), (builder) => {
                    builder.on(
                        'estados.id',
                        '=',
                        this.connection.raw('COALESCE(transiciones.siguiente_estado_id, transiciones.estado_actual_id)')
                    );
                })
                .select(this.connection.raw('??.?? as entity_id', [tableName, 'id']), entityNameColumn, estadoIdColumn)
                .count('cases.id as count')
                .groupBy([
                    this.connection.raw('??.??', [tableName, 'id']),
                    ...(tableColumns.last_name
                        ? [
                              this.connection.raw('??.??', [tableName, tableColumns.name]),
                              this.connection.raw('??.??', [tableName, tableColumns.last_name]),
                          ]
                        : [this.connection.raw('??.??', [tableName, tableColumns.name])]),
                    this.connection.raw('COALESCE(transiciones.siguiente_estado_id, transiciones.estado_actual_id)'),
                ]);

            Object.entries(filters).forEach(([column, value]) => {
                countCasosQuery.where(this.connection.raw('??.?? = ?', ['cases', column, value]));
            });

            const countCasos = await countCasosQuery;

            if (!Array.isArray(countCasos)) {
                throw new Error('El resultado de countCasos no es un array iterable.');
            }

            const groups = {};

            countCasos.forEach((row) => {
                const { entity_id, entity_name, estado_id, count } = row;

                if (!groups[entity_id]) {
                    groups[entity_id] = {
                        id: entity_id,
                        nombre: entity_name,
                        estados: [],
                    };
                }

                groups[entity_id].estados.push({
                    id: estado_id,
                    estado: estado_id ? estadosMap[estado_id] || 'Desconocido' : 'Desconocido',
                    count: parseInt(count, 10),
                });
            });

            return [groups];
        } catch (error) {
            Helper.logError('Error counting cases by status', error);
            throw new QueryDBError('count');
        }
    }

    async getCountsWithReferences(filters = {}) {
        try {
            const countCasosQuery = this.table('estados')
                .leftJoin(this.qualifiedName('transiciones'), 'estados.id', 'transiciones.siguiente_estado_id')
                .leftJoin(this.qualifiedName('cases'), 'transiciones.id', 'cases.transicion_id')
                .select('estados.id', 'estados.nombre', 'estados.icon_class')
                .count('cases.id as count')
                .whereNull('estados.deleted_by')
                .whereNull('cases.deleted_at')
                .whereNull('transiciones.deleted_at')
                .whereNull('cases.fecha_resolucion')
                .modify((query) => {
                    if (filters.field && filters.value) {
                        query.where(this.connection.raw('??.?? = ?', ['cases', filters.field, filters.value]));
                    }
                })
                .groupBy('estados.id', 'estados.nombre', 'estados.icon_class');

            return await countCasosQuery;
        } catch (error) {
            Helper.logError('Error counting cases by references', error);
            throw new QueryDBError('count');
        }
    }

    /**
     *
     * @returns {string[]} list of fields for select
     */
    #addSelectFields() {
        return [
            'cases.id',
            'cases.reference',
            'cases.folio',
            'cases.created_at',
            'cases.created_by',
            'cases.transicion_id',
            'clasificaciones.nivel1',
            'clasificaciones.nivel2',
            'clasificaciones.nivel3',
            'clasificaciones.nivel4',
            'clasificaciones.nivel5',
            'clasificaciones.nivel6',
            'clasificaciones.nivel7',
            'clasificaciones.nivel8',
            'clasificaciones.nivel9',
            'clasificaciones.nivel10',
            'ans.color_ans_inicial',
            'ans.color_ans_intermedio',
            'ans.color_ans_final',
            'estados.nombre as estadoActual',
            'cases.antiguedad',
            'cases.updated_at',
            'cases.ans_posicion',
            'responsable.nombres',
            'responsable.apellido1',
            'responsable.apellido2',
            'responsable.login',
            'responsable.is_active as usuario_inactivo',
            'creador.external_id as creator_external_id',
            'clients.nombres as nombreCliente',
            'clients.apellido1 as primerApellido',
            'clients.apellido2 as segundoApellido',
            'clients.documento',
            'clients.tipo_cliente',
            'clients.nombre_empresa',
            'cases.cambio_estado_comentario_id',
            'cases.caso_clonado_id',
            'cases.fecha_resolucion',
            'cases.antiguedad_dias',
            'cases.antiguedad_horas',
            'cases.antiguedad_minutos',
            'cases.motivo_baja',
            'cases.sla_due_date',
            'cases.sla_state_position',
            'cases.parent_id',
            'cases.is_visible',
        ];
    }

    /**
     * Reader-routed seed builder for audited read-only list/count queries. Resolves this.read
     * lazily so it honors read-after-write (read-write-split.md §4.6). Schema qualification is
     * preserved by the read facade (same as this.table()).
     * @returns {import('knex').Knex.QueryBuilder}
     */
    #readTable() {
        return this.read.table(this.tableName);
    }

    /**
     *
     * @param {Knex} partialQuery partial query to fetch
     * @returns {KnexQuery} query with joins
     * @private
     * @description This method is used to add relationships to the query
     * @example
     * const query = this.connection(this.tableName).select(this.#addSelectFields());
     */
    #addRelationships(partialQuery) {
        return partialQuery
            .join(this.qualifiedName('clients'), 'clients.id', 'cases.cliente_id')
            .join(this.qualifiedName('grupos'), 'grupos.id', 'cases.grupo_id')
            .join(`${this.qualifiedName('usuarios')} as responsable`, 'responsable.id', 'cases.responsable_id')
            .join(this.qualifiedName('transiciones'), 'transiciones.id', 'cases.transicion_id')
            .join(this.qualifiedName('clasificaciones'), 'clasificaciones.id', 'cases.clasificacion_id')
            .leftJoin(this.qualifiedName('ans'), 'ans.id', 'clasificaciones.ans_id')
            .leftJoin(
                `${this.qualifiedName('descripciones_casos')} as descripcion`,
                'descripcion.id',
                'cases.descripcion_caso_id'
            )
            .leftJoin(this.qualifiedName('estados'), 'estados.id', 'transiciones.siguiente_estado_id')
            .leftJoin(`${this.qualifiedName('usuarios')} as creador`, 'creador.id', 'cases.created_by');
    }

    /**
     *
     * @param {object} rows array of history
     * @description This method is used to transform history to transitions
     * @returns {Promise<Object>}
     */
    async #transformHistoryToTransitions(rows) {
        const transitions = [];
        let previous = { transitionDate: null, updatedById: null, reclassification: null, alsoChangedState: false };
        rows.forEach((row, index) => {
            if (index === 0) {
                return;
            }

            // `clasificacion_id` abre tramo también sin cambio de estado: una reclasificación
            // dentro del mismo flujo destino no toca `transicion_id`, y sin esta condición esa
            // fila se descartaba entera —el nodo de reclasificación desaparecía del timeline.
            if (
                row.changed_attributes.hasOwnProperty('transicion_id') ||
                row.changed_attributes.hasOwnProperty('clasificacion_id')
            ) {
                const changedAtts =
                    typeof row.changed_attributes === 'string'
                        ? JSON.parse(row.changed_attributes)
                        : row.changed_attributes;
                const newAtts =
                    typeof row.new_attributes === 'string' ? JSON.parse(row.new_attributes) : row.new_attributes;
                transitions.push({ row: rows[index - 1], ...previous });
                previous = {
                    transitionDate: newAtts?.updated_at ?? newAtts?.created_at ?? null,
                    updatedById: changedAtts?.updated_by ?? null,
                    reclassification: KnexCaseRepository.#reclassificationOf(changedAtts),
                    // AUD-1c: esta MISMA escritura reclasificó y movió el caso de estado —el
                    // guardado del formulario reclasificado es uno solo. Sin esto el timeline
                    // mostraba los dos hechos pegados en un único nodo.
                    alsoChangedState: changedAtts.hasOwnProperty('transicion_id'),
                };
            }
        });

        const filterTransitions = transitions.reverse();
        const lastRow = rows[rows.length - 1];
        filterTransitions.unshift({ row: lastRow, ...previous });

        const reasons = await this.#reclassificationReasonsOf(filterTransitions);

        const transitionPromises = filterTransitions.map(
            async ({ row, transitionDate, updatedById, reclassification, alsoChangedState }) => {
                const { original_attributes, new_attributes } = row;
                const resolvedReclassification = reclassification && {
                    ...reclassification,
                    reason: reasons.get(reclassification.reasonCommentId) ?? null,
                };

                // AUD-1c: reclasificar Y cambiar de estado a la vez son dos hechos, no uno; se
                // devuelven como dos entradas de timeline —reclasificación sin estado, y el
                // cambio de estado normal— en vez de mezclarlos en un único nodo.
                if (resolvedReclassification && alsoChangedState) {
                    const stateChange = await new CaseTransitions(this).execute(
                        original_attributes,
                        new_attributes,
                        transitionDate,
                        updatedById,
                        null
                    );
                    const reclassificationOnly = await new CaseTransitions(this).execute(
                        original_attributes,
                        new_attributes,
                        transitionDate,
                        updatedById,
                        resolvedReclassification,
                        { includeState: false }
                    );
                    return [stateChange, reclassificationOnly];
                }

                return [
                    await new CaseTransitions(this).execute(
                        original_attributes,
                        new_attributes,
                        transitionDate,
                        updatedById,
                        resolvedReclassification
                    ),
                ];
            }
        );

        return (await Promise.all(transitionPromises)).flat();
    }

    /**
     * Motivos de todas las reclasificaciones del timeline, en UNA consulta.
     *
     * Resolverlos aquí y no dentro de `CaseTransitions` es lo que evita una consulta por tramo:
     * el timeline de un caso movido varias veces las multiplicaría. El agregado recibe el texto
     * ya resuelto y se limita a formatearlo.
     *
     * @param {Array<{reclassification: {reasonCommentId: string|null}|null}>} transitions
     * @returns {Promise<Map<string, string>>} descripción por id de comentario
     */
    async #reclassificationReasonsOf(transitions) {
        const commentIds = [
            ...new Set(transitions.map(({ reclassification }) => reclassification?.reasonCommentId).filter(Boolean)),
        ];

        if (commentIds.length === 0) {
            return new Map();
        }

        const comments = await this.read.table('comentarios').select('id', 'descripcion').whereIn('id', commentIds);

        return new Map(comments.map((comment) => [comment.id, comment.descripcion]));
    }

    /**
     * AUD-1b — describe la escritura que abrió este tramo del timeline cuando fue una
     * reclasificación, o `null` si fue un cambio de estado corriente.
     *
     * La señal es el DIFF (`changed_attributes`), no el snapshot: `new_attributes` guarda el caso
     * entero, así que leer de ahí marcaría como reclasificación todas las transiciones siguientes.
     *
     * Y dentro del diff la señal es `clasificacion_id`, no `cambio_clasificacion`: ese flag es
     * PEGAJOSO —una vez en `true` ya no vuelve a cambiar—, así que solo aparece en el diff de la
     * PRIMERA reclasificación del caso y la segunda se pintaba como un cambio de estado
     * corriente, sin su motivo. Que la clasificación cambie en esa escritura es además la
     * definición literal de lo que el timeline quiere contar.
     *
     * @param {object} changedAttributes
     * @returns {{ reasonCommentId: string|null }|null}
     */
    static #reclassificationOf(changedAttributes) {
        if (changedAttributes?.clasificacion_id == null) {
            return null;
        }

        return { reasonCommentId: changedAttributes.cambio_estado_comentario_id ?? null };
    }

    /**
     * Builds the base query to retrieve cases with the necessary table relationships.
     * @returns {object} - The constructed query.
     */
    #buildBaseQueryAns() {
        return this.table()
            .leftJoin(this.qualifiedName('clasificaciones'), 'cases.clasificacion_id', 'clasificaciones.id')
            .leftJoin(this.qualifiedName('ans'), 'clasificaciones.ans_id', 'ans.id')
            .leftJoin(this.qualifiedName('grupos'), 'cases.grupo_id', 'grupos.id')
            .leftJoin(this.qualifiedName('shift_management'), 'grupos.horario_id', 'shift_management.id')
            .leftJoin(this.qualifiedName('transiciones'), 'cases.transicion_id', 'transiciones.id')
            .leftJoin({ transitions_ans: this.qualifiedName('ans') }, 'transiciones.ans_id', 'transitions_ans.id')
            .leftJoin(`${this.qualifiedName('global_configurations')} as gc`, 'grupos.configuration_id', 'gc.id');
    }

    /**
     * Finds a case by its ID.
     * @param {ValueObjectUuid} id - The ID of the case to find.
     * @returns {Promise<Array<{
     *   kase: Case,
     *   caseAns: Ans,
     *   shiftManagement: ShiftManagement,
     *   stateAns: Ans,
     *   globalConfig: object
     * }>>} Array of objects containing related case entities
     */
    async findByIdForAns(id) {
        try {
            const columns = await this.generateAliasedColumns(['cases', 'ans', 'shift_management']);
            const columnsAns = await this.generateAliasedColumns(['ans'], 'transitions_ans');
            const mergedColumns = [...columns, ...columnsAns, 'gc.settings'];
            Helper.logDebug2(`KnexCaseRepository.findByIdForAns: columns: `, mergedColumns);

            const row = await this.#buildBaseQueryAns().select(mergedColumns).where('cases.id', id.value).first();
            if (!row) {
                return [];
            }
            return this.#prepareEntities([row]);
        } catch (error) {
            // Let domain precondition errors (missing ANS/schedule/cases columns) surface with their
            // clear message instead of being masked by the generic "Transaction failed" wrapper.
            if (error instanceof CustomError) {
                throw error;
            }
            Helper.logError('Error finding cases by ans', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds unresolved cases by measurement type.
     * @param {string} measurementType - The measurement type to filter the cases by.
     * @returns {Promise<Array<{
     *   kase: Case,
     *   caseAns: Ans,
     *   shiftManagement: ShiftManagement,
     *   stateAns: Ans,
     *   globalConfig: object
     * }>>} Array of objects containing related case entities
     */
    async findUnresolvedByMeasurementType(measurementType) {
        try {
            const columns = await this.generateAliasedColumns(['cases', 'ans', 'shift_management']);
            const columnsAns = await this.generateAliasedColumns(['ans'], 'transitions_ans');
            const mergedColumns = [...columns, ...columnsAns, 'gc.settings'];

            const query = this.#buildBaseQueryAns()
                .whereNull('cases.fecha_resolucion')
                .whereNull('cases.deleted_at')
                .andWhere('ans.medicion_ans_id', measurementType)
                .select(mergedColumns);

            Helper.logDebug(query.toQuery());
            const rows = await query;
            return this.#prepareEntities(rows);
        } catch (error) {
            if (error instanceof CustomError) {
                throw error;
            }
            Helper.logError(
                `Error al buscar casos no resueltos por tipo de medición ${measurementType}: ${error.message}`
            );
            throw new QueryDBError('find');
        }
    }

    /**
     * Keyset-paginated variant of `findUnresolvedByMeasurementType`. Returns up to `limit`
     * unresolved cases for the given measurement type whose `id > afterId`, ordered by `id ASC`.
     *
     * @param {{ measurementType: string, afterId: string | null, limit: number }} args
     * @returns {Promise<Array<{ kase, caseAns, shiftManagement, stateAns, globalConfig }>>}
     */
    async findUnresolvedByMeasurementTypePaginated({ measurementType, afterId, limit }) {
        try {
            const columns = await this.generateAliasedColumns(['cases', 'ans', 'shift_management']);
            const columnsAns = await this.generateAliasedColumns(['ans'], 'transitions_ans');
            const mergedColumns = [...columns, ...columnsAns, 'gc.settings'];

            // UUID-v4 ids are always lexicographically greater than the all-zeros sentinel.
            const cursor = afterId ?? '00000000-0000-0000-0000-000000000000';

            const query = this.#buildBaseQueryAns()
                .whereNull('cases.fecha_resolucion')
                .whereNull('cases.deleted_at')
                .andWhere('ans.medicion_ans_id', measurementType)
                .andWhere('cases.id', '>', cursor)
                .orderBy('cases.id', 'asc')
                .limit(limit)
                .select(mergedColumns);

            // logDebug intentionally omitted on hot path — 90 calls/tenant/tick.
            const rows = await query;
            return this.#prepareEntities(rows);
        } catch (error) {
            if (error instanceof CustomError) {
                throw error;
            }
            Helper.logError(
                `findUnresolvedByMeasurementTypePaginated failed for ${measurementType} after ${afterId}: ${error.message}`
            );
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param rows
     * @returns {Array<{
     *   kase: Case,
     *   caseAns: Ans,
     *   shiftManagement: ShiftManagement,
     *   stateAns: Ans,
     *   globalConfig: object
     * }>} Array of objects containing related case entities
     */
    #prepareEntities(rows) {
        if (!rows || rows.length === 0) {
            return [];
        }

        const entities = [];

        for (const row of rows) {
            let kaseDto = Object.entries(row)
                .filter(([key]) => key.startsWith('cases_'))
                .reduce((acc, [key, value]) => {
                    const newKey = key.replace('cases_', '');
                    acc[newKey] = value;
                    return acc;
                }, {});
            const caseAnsDto = Object.entries(row)
                .filter(([key]) => key.startsWith('ans_'))
                .reduce((acc, [key, value]) => {
                    const newKey = key.replace('ans_', '');
                    acc[newKey] = value;
                    return acc;
                }, {});
            const shiftManagementDto = Object.entries(row)
                .filter(([key]) => key.startsWith('shift_management_'))
                .reduce((acc, [key, value]) => {
                    const newKey = key.replace('shift_management_', '');
                    acc[newKey] = value;
                    return acc;
                }, {});
            const stateAnsDto = Object.entries(row)
                .filter(([key]) => key.startsWith('transitions_ans_'))
                .reduce((acc, [key, value]) => {
                    const newKey = key.replace('transitions_ans_', '');
                    acc[newKey] = value;
                    return acc;
                }, {});

            // Domain preconditions: surface a clear, diagnosable error instead of the cryptic
            // "id: The value cannot be null" thrown deep inside a value object. These run before
            // the SQLite parse (which dereferences shiftManagementDto) and outside the try/catch
            // below so the message is not masked by the generic "Error when preparing entities".
            if (!kaseDto.id) {
                throw new CustomError(
                    "No se pudieron mapear columnas de 'cases' (metadata de esquema vacía para el tenant)",
                    500
                );
            }
            if (!caseAnsDto.id) {
                throw new CustomError(`El caso ${kaseDto.id} no tiene ANS de clasificación configurada`, 422);
            }
            if (!shiftManagementDto.id) {
                throw new CustomError(`El caso ${kaseDto.id} no tiene horario (shift_management) configurado`, 422);
            }

            try {
                entities.push({
                    kase: new Case(kaseDto),
                    caseAns: new Ans(caseAnsDto),
                    shiftManagement: new ShiftManagement(shiftManagementDto),
                    stateAns: stateAnsDto.id ? new Ans(stateAnsDto) : new Ans(caseAnsDto),
                    globalConfig: row.settings,
                });
            } catch (e) {
                Helper.logError(`Error preparing entities for case with ID ${kaseDto.id}: ${e.message}`, e);
                throw new CustomError('Error when preparing entities', 500);
            }
        }

        return entities;
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            return await EntityCache.get(
                CASES_COUNT_NAMESPACE,
                buildCountCacheKey(criteria),
                async () => {
                    const query = criteria.convertToKnex(this.#readTable().count());
                    query.whereNull(`${this.tableName}.deleted_at`);
                    const [count] = await query;
                    return count;
                },
                CASES_COUNT_TTL_MS
            );
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('count');
        }
    }

    async getCasesCountByUsers({ idField, ids }) {
        return this.table()
            .select([
                `${idField} as id`,
                this.connection.raw('COUNT(CASE WHEN ans_posicion = 1 THEN 1 END) as posicion_1'),
                this.connection.raw('COUNT(CASE WHEN ans_posicion = 2 THEN 1 END) as posicion_2'),
                this.connection.raw('COUNT(CASE WHEN ans_posicion = 3 THEN 1 END) as posicion_3'),
            ])
            .whereIn(idField, ids)
            .where({
                fecha_resolucion: null,
                deleted_at: null,
            })
            .groupBy(idField);
    }

    /**
     * Finds Available States a case by its ID.
     * @param {ValueObjectUuid} id - The ID of the case to find.
     * @returns {Promise<AvailableStates[]>} - The found case or null if it does not exist.
     */
    async findByIdForAvailableStates(id) {
        try {
            const currentTransition = await this.read
                .table('cases')
                .select('transiciones.*')
                .leftJoin(this.qualifiedName('transiciones'), 'cases.transicion_id', 'transiciones.id')
                .where('cases.id', id.value)
                .first();

            if (!currentTransition) {
                return null;
            }

            const transitions = await this.read
                .table('transiciones')
                .select('*')
                .where('flujo_id', currentTransition.flujo_id)
                .where('estado_actual_id', currentTransition.siguiente_estado_id)
                .whereNot('siguiente_estado_id', currentTransition.siguiente_estado_id)
                .where('is_visible', true)
                .where('status', StatusEnum.ACTIVE.value);

            const estadoIds = new Set();
            for (const t of transitions) {
                estadoIds.add(t.estado_actual_id);
                estadoIds.add(t.siguiente_estado_id);
            }

            const estados = await this.read
                .table('estados')
                .select('*')
                .whereIn('id', [...estadoIds]);

            const estadosMap = new Map(estados.map((e) => [e.id, e]));

            const result = transitions.map(
                (t) =>
                    new CaseAvailableStates(
                        t,
                        estadosMap.get(t.estado_actual_id),
                        estadosMap.get(t.siguiente_estado_id)
                    )
            );
            return result;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async getOneScriptUrl(classificationId, groupId) {
        try {
            const classificationGroupRelationships = await this.table('classification_group_relationships')
                .select('*')
                .where({ classification_id: classificationId, group_id: groupId })
                .first();

            if (!classificationGroupRelationships || classificationGroupRelationships.length === 0) {
                return;
            }

            const oneScriptInformation = await this.table('one-script')
                .select('*')
                .where({ id: classificationGroupRelationships.form })
                .first();

            return oneScriptInformation.url;
        } catch (error) {
            Helper.logError('Error finding classification-group relationship:', error);
            throw new QueryDBError('find');
        }
    }

    async getCaseInformationWithRelations(caseId) {
        try {
            const kase = await this.table('cases').where({ id: caseId.value }).first();
            const aux_case = await this.table('aux_cases').where({ caso_id: caseId.value }).first();
            const client = await this.table('clients').where({ id: kase.cliente_id }).first();
            const aux_client = await this.table('aux_clients').where({ cliente_id: kase.cliente_id }).first();
            const result = {
                case: kase,
                aux_case,
                client,
                aux_client,
            };

            Helper.logDebug(`getCaseInformationWithRelations: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            Helper.logError('Error fetching case information', error);
            throw new QueryDBError('custom', 'Error fetching case information');
        }
    }

    async getCaseInformationWithAllRelations(caseId) {
        try {
            const kase = await this.table('cases')
                .select(this.#CASE_RESPONSE_COLUMNS)
                .where({ id: caseId.value })
                .first();
            if (!kase) return null;

            let client = null;
            if (kase.cliente_id) {
                client = await this.table('clients')
                    .select(
                        'tipo_cliente',
                        'tipo_documento',
                        'documento',
                        'nombres',
                        'apellido1',
                        'apellido2',
                        'nombre_empresa',
                        'sexo',
                        'estado_civil',
                        'fecha_nacimiento',
                        'email',
                        'email_alterno',
                        'telefono',
                        'telefono_alterno'
                    )
                    .where({ id: kase.cliente_id })
                    .first();
            }

            let transition = null;
            let transitionsAvailable = null;
            let statesAvailable = null;
            if (kase.transicion_id) {
                transition = await this.table('transiciones')
                    .select('estado_actual_id', 'siguiente_estado_id', 'flujo_id', 'status')
                    .where({ id: kase.transicion_id })
                    .first();

                let estadoActual = null;
                if (transition?.estado_actual_id) {
                    estadoActual = await this.table('estados')
                        .where({ id: transition?.estado_actual_id })
                        .column([
                            'nombre',
                            'tipo_id',
                            'descripcion',
                            'icon_class',
                            'status',
                            'color',
                            'require_observation',
                        ])
                        .first();
                    transition.estado_actual = estadoActual;
                }

                let siguienteEstado = null;
                if (transition?.siguiente_estado_id) {
                    siguienteEstado = await this.table('estados')
                        .where({ id: transition?.siguiente_estado_id })
                        .first();
                    transition.siguiente_estado = siguienteEstado;

                    transitionsAvailable = await this.table('transiciones')
                        .select('id', 'estado_actual_id', 'siguiente_estado_id', 'flujo_id', 'status')
                        .where('flujo_id', '=', transition?.flujo_id)
                        .andWhere('estado_actual_id', '=', transition.siguiente_estado_id)
                        .andWhere('is_visible', '=', true)
                        .andWhere('status', '=', StatusEnum.ACTIVE.value)
                        .whereNull('deleted_at');

                    let states = null;
                    if (transitionsAvailable) {
                        states = await this.table('estados')
                            .whereIn(
                                'id',
                                transitionsAvailable.map((t) => t.siguiente_estado_id)
                            )
                            .column([
                                'id',
                                'nombre',
                                'tipo_id',
                                'descripcion',
                                'icon_class',
                                'status',
                                'color',
                                'require_observation',
                            ])
                            .select();

                        statesAvailable = states;
                    }
                }
            }

            let responsable = null;
            if (kase.responsable_id) {
                responsable = await this.table('usuarios')
                    .select('nombres', 'apellido1', 'apellido2', 'email', 'telefono', 'movil', 'is_active')
                    .where({ id: kase.responsable_id })
                    .first();
            }

            let clasificacion = null;
            if (kase.clasificacion_id) {
                clasificacion = await this.table('clasificaciones')
                    .select('*')
                    .where({ id: kase.clasificacion_id })
                    .first();
            }

            let descripcion_caso = null;
            if (kase.descripcion_caso_id) {
                descripcion_caso = await this.table('descripciones_casos')
                    .select('descripcion')
                    .where({ id: kase.descripcion_caso_id })
                    .first();
            }

            let grupo = null;
            if (kase.grupo_id) {
                grupo = await this.table('grupos').select('nombre', 'descripcion').where({ id: kase.grupo_id }).first();
            }

            let caso_clonado = null;
            if (kase.caso_clonado_id) {
                caso_clonado = await this.table('cases')
                    .select('id', 'reference')
                    .where({ id: kase.caso_clonado_id })
                    .first();
            }

            let onescript = null;
            if (clasificacion?.id && grupo?.id) {
                const relationship = await this.table('classification_group_relationships')
                    .select('form')
                    .where({ classification_id: clasificacion.id, group_id: grupo.id })
                    .first();

                if (relationship?.form) {
                    onescript = await this.table('one-script')
                        .where({ id: relationship.form })
                        .column(['id', 'name', 'url', 'url_api', 'schema_id', 'onescript_reference_id'])
                        .select();
                }
            }

            let attachments = await this.table('case_attachments')
                .where('case_id', kase.id)
                .whereNull('deleted_by')
                .whereNull('deleted_at')
                .column(['id', 'case_id', 'description', 'size', 'path', 'type', 'is_active', 'attachment_type'])
                .select();

            const aux_case = await this.table('aux_cases').where({ caso_id: caseId.value }).first();
            if (aux_case) {
                delete aux_case.deleted_at;
                delete aux_case.deleted_by;
                const { data, truncated } = trimAuxData(aux_case.data, AUX_BUDGET_BYTES);
                aux_case.data = data;
                if (truncated.length) {
                    aux_case._truncated = truncated;
                }
            }
            const aux_client = await this.table('aux_clients').where({ cliente_id: kase.cliente_id }).first();
            if (aux_client) {
                delete aux_client.deleted_at;
                delete aux_client.deleted_by;
                const { data, truncated } = trimAuxData(aux_client.data, AUX_BUDGET_BYTES);
                aux_client.data = data;
                if (truncated.length) {
                    aux_client._truncated = truncated;
                }
            }

            const result = {
                ...kase,
                cliente: client,
                transicion: transition,
                transitions_available: {
                    transitions: transitionsAvailable,
                    states: statesAvailable,
                },
                responsable,
                clasificacion,
                descripcion_caso,
                grupo,
                attachments,
                one_script: onescript,
                caso_clonado,
                aux_case,
                aux_client,
            };

            if (kase.parent_id) {
                const parentRow = await this.table('cases')
                    .select(this.#CASE_RESPONSE_COLUMNS)
                    .where({ id: kase.parent_id })
                    .first();
                if (parentRow) {
                    let p_cliente = null;
                    if (parentRow.cliente_id) {
                        p_cliente = await this.table('clients')
                            .select(
                                'tipo_cliente',
                                'tipo_documento',
                                'documento',
                                'nombres',
                                'apellido1',
                                'apellido2',
                                'nombre_empresa',
                                'sexo',
                                'estado_civil',
                                'fecha_nacimiento',
                                'email',
                                'email_alterno',
                                'telefono',
                                'telefono_alterno'
                            )
                            .where({ id: parentRow.cliente_id })
                            .first();
                    }

                    let p_transicion = null;
                    if (parentRow.transicion_id) {
                        p_transicion = await this.table('transiciones')
                            .select('estado_actual_id', 'siguiente_estado_id', 'flujo_id', 'status')
                            .where({ id: parentRow.transicion_id })
                            .first();
                    }

                    let p_responsable = null;
                    if (parentRow.responsable_id) {
                        p_responsable = await this.table('usuarios')
                            .select('nombres', 'apellido1', 'apellido2', 'email', 'telefono', 'movil', 'is_active')
                            .where({ id: parentRow.responsable_id })
                            .first();
                    }

                    let p_clasificacion = null;
                    if (parentRow.clasificacion_id) {
                        p_clasificacion = await this.table('clasificaciones')
                            .select('description')
                            .where({ id: parentRow.clasificacion_id })
                            .first();
                    }

                    let p_descripcion_caso = null;
                    if (parentRow.descripcion_caso_id) {
                        p_descripcion_caso = await this.table('descripciones_casos')
                            .select('descripcion')
                            .where({ id: parentRow.descripcion_caso_id })
                            .first();
                    }

                    let p_grupo = null;
                    if (parentRow.grupo_id) {
                        p_grupo = await this.table('grupos')
                            .select('nombre', 'descripcion')
                            .where({ id: parentRow.grupo_id })
                            .first();
                    }

                    let p_caso_clonado = null;
                    if (parentRow.caso_clonado_id) {
                        p_caso_clonado = await this.table('cases')
                            .select('id', 'reference')
                            .where({ id: parentRow.caso_clonado_id })
                            .first();
                    }

                    result.parent = {
                        ...parentRow,
                        cliente: p_cliente,
                        transicion: p_transicion,
                        responsable: p_responsable,
                        clasificacion: p_clasificacion,
                        descripcion_caso: p_descripcion_caso,
                        grupo: p_grupo,
                        caso_clonado: p_caso_clonado,
                    };
                }
            }
            return result;
        } catch (error) {
            Helper.logError('Error fetching case with all relations', error);
            throw new QueryDBError('custom', 'Error fetching case information with all relations');
        }
    }

    async findByExternalCode(externalCode) {
        try {
            const result = await this.table().where({ external_code: externalCode }).whereNull('deleted_at').first();
            return result ? new Case(result) : null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByExternalCode');
        }
    }

    #CASE_RESPONSE_COLUMNS = [
        'id',
        'cliente_id',
        'transicion_id',
        'responsable_id',
        'clasificacion_id',
        'descripcion_caso_id',
        'caso_clonado_id',
        'cambio_estado_comentario_id',
        'grupo_id',
        'fecha_resolucion',
        'antiguedad',
        'ans_posicion',
        'antiguedad_dias',
        'antiguedad_horas',
        'antiguedad_minutos',
        'motivo_baja',
        'alto_impacto',
        'vista',
        'cambio_clasificacion',
        'reference',
        'external_code',
        'folio',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
        'sla_due_date',
        'sla_state_due_date',
        'parent_id',
        'is_visible',
        'first_view_at',
        'update_source',
    ];

    /**
     *
     * @param {object} criteria object criteria for search case
     * @param {{ is_visible: boolean }} values
     * @returns {Promise<CaseDataGrid[]>}
     */
    async updateByCriteria(criteria, values) {
        try {
            const searchQuery = this.table().select(this.#addSelectFields());

            criteria.convertToKnex(searchQuery);
            searchQuery.whereNull('cases.deleted_by');

            const rows = await this.#addRelationships(searchQuery);

            if (rows.length === 0) {
                return [];
            }

            const caseIds = rows.map((row) => row.id);

            await this.table().whereIn('id', caseIds).whereNull('deleted_by').update({
                is_visible: values.is_visible,
                updated_at: this.connection.fn.now(),
            });
            invalidateCaseCountCaches();

            const refreshedQuery = this.table()
                .select(this.#addSelectFields())
                .whereIn('cases.id', caseIds)
                .whereNull('cases.deleted_by');

            const refreshedRows = await this.#addRelationships(refreshedQuery);

            return refreshedRows.map((row) => new CaseDataGrid(row));
        } catch (error) {
            Helper.logError('Error updating cases by criteria', error);
            throw new QueryDBError('updateByCriteria');
        }
    }

    async findByIds(ids, { trx, forUpdate } = {}) {
        try {
            const query = (trx ? this.trxTable(trx) : this.table())
                .select(
                    'id',
                    'reference',
                    'cliente_id',
                    'transicion_id',
                    'fecha_resolucion',
                    'responsable_id',
                    'grupo_id',
                    'created_by',
                    'updated_by',
                    'created_at',
                    'updated_at',
                    'update_source',
                    'state_change_at'
                )
                .whereIn('id', ids)
                .whereNull('deleted_by')
                .orderBy('id');
            if (forUpdate) query.forUpdate();
            return await query;
        } catch (error) {
            Helper.logError('Error finding cases by ids', error);
            throw new QueryDBError('find');
        }
    }

    async findSummaryByIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        try {
            const responsibleName = this.connection.raw(
                "trim(coalesce(responsable.nombres, '') || ' ' || coalesce(responsable.apellido1, '') || ' ' || coalesce(responsable.apellido2, '')) as responsible_name"
            );

            return await this.table()
                .select(
                    'cases.id',
                    'cases.external_code',
                    'cases.reference',
                    'cases.created_at',
                    'cases.parent_id',
                    'estados.nombre as estadoActual',
                    'clasificaciones.nivel1',
                    'clasificaciones.nivel2',
                    'clasificaciones.nivel3',
                    'clasificaciones.nivel4',
                    'clasificaciones.nivel5',
                    'clasificaciones.nivel6',
                    'clasificaciones.nivel7',
                    'clasificaciones.nivel8',
                    'clasificaciones.nivel9',
                    'clasificaciones.nivel10',
                    'responsable.login as responsible_login',
                    responsibleName
                )
                .leftJoin(this.qualifiedName('clasificaciones'), 'cases.clasificacion_id', 'clasificaciones.id')
                .leftJoin(this.qualifiedName('transiciones'), 'cases.transicion_id', 'transiciones.id')
                .leftJoin(this.qualifiedName('estados'), 'estados.id', 'transiciones.siguiente_estado_id')
                .leftJoin(`${this.qualifiedName('usuarios')} as responsable`, 'responsable.id', 'cases.responsable_id')
                .whereIn('cases.id', ids)
                .whereNull('cases.deleted_by')
                .orderBy('cases.id');
        } catch (error) {
            Helper.logError('Error in findSummaryByIds', error);
            throw new QueryDBError('findSummaryByIds');
        }
    }

    async #bulkUpdate(caseIds, values, operationName, { trx } = {}) {
        try {
            await (trx ? this.trxTable(trx) : this.table())
                .whereIn('id', caseIds)
                .whereNull('deleted_by')
                .update(values);
            invalidateCaseCountCaches();
        } catch (error) {
            Helper.logError(`Error in ${operationName}`, error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Único camino que escribe `transicion_id` sin pasar por el agregado `Case`, así que la
     * derivación de `estado_id` se aplica aquí y no en `#bulkUpdate`, que también sirve a
     * `bulkUpdateSlaTimers` —donde no hay transición que arrastrar—.
     */
    async bulkUpdateTransition(caseIds, values, { trx } = {}) {
        const valuesWithEstado =
            values.transicion_id === undefined || values.estado_id !== undefined
                ? values
                : { ...values, estado_id: this.#estadoIdFromTransition(values.transicion_id, trx) };

        return this.#bulkUpdate(caseIds, valuesWithEstado, 'bulkUpdateTransition', { trx });
    }

    async bulkSaveTransitionHistory(cases, values, { trx } = {}) {
        try {
            const now = new Date().toISOString();
            const changedAttributes = {
                transicion_id: values.transicion_id,
                state_change_at: values.state_change_at,
                updated_at: values.updated_at,
                updated_by: values.updated_by,
                update_source: values.update_source,
                ...(values.edited_by !== undefined && { edited_by: values.edited_by }),
                ...(values.edited_at !== undefined && { edited_at: values.edited_at }),
            };
            const records = cases.map((kase) => ({
                id: uuidV4(),
                entity_id: kase.id,
                changed_attributes: JSON.stringify(changedAttributes),
                new_attributes: JSON.stringify({ ...kase, ...values }),
                original_attributes: JSON.stringify(kase),
                created_at: now,
                created_by: values.updated_by,
            }));
            await (trx ? this.trxTable(trx, 'history_cases') : this.table('history_cases')).insert(records);
        } catch (error) {
            Helper.logError('Error in bulkSaveTransitionHistory', error);
            throw new QueryDBError('bulkSaveTransitionHistory');
        }
    }

    async bulkClose(caseIds, values, { trx } = {}) {
        return this.#bulkUpdate(caseIds, values, 'bulkClose', { trx });
    }

    async bulkAssign(caseIds, values, { trx } = {}) {
        const hasResponsible = values?.responsable_id != null && values.responsable_id !== '';
        if (!hasResponsible) {
            return this.#bulkUpdate(caseIds, values, 'bulkAssign', { trx });
        }

        const run = async (t) => {
            await this.trxTable(t)
                .whereIn('id', caseIds)
                .whereNull('deleted_by')
                .whereNot('responsable_id', values.responsable_id)
                .update({ first_view_at: null });

            await this.#bulkUpdate(caseIds, values, 'bulkAssign', { trx: t });
        };

        try {
            if (trx) {
                await run(trx);
            } else {
                await this.connection.transaction(run);
            }
        } catch (error) {
            Helper.logError('Error in bulkAssign', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Registra de forma atómica la primera vista del responsable sobre un caso.
     * Solo escribe `first_view_at` si el usuario es el responsable actual y el campo sigue en
     * null; la condición en el WHERE garantiza que solo un escritor concurrente lo setee.
     *
     * @param {{ caseId: string, userId: string, when?: Date }} params
     * @returns {Promise<Date|null>} El timestamp aplicado, o `null` si no correspondía registrarlo.
     */
    async markFirstViewByResponsible({ caseId, userId, when = new Date() }) {
        if (!caseId || !userId) {
            return null;
        }

        try {
            const affected = await this.table()
                .where({ id: caseId, responsable_id: userId })
                .whereNull('first_view_at')
                .whereNull('deleted_at')
                .update({ first_view_at: when });

            return affected > 0 ? when : null;
        } catch (error) {
            Helper.logError('Error in markFirstViewByResponsible', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Inserts one `history_cases` record per case reflecting a bulk assignment.
     *
     * @param {Array<Object>} originalCases - Raw case rows fetched BEFORE the bulk update (from findByIds).
     * @param {Object} values - The payload used in the bulk update (grupo_id, responsable_id, updated_by, updated_at, update_source).
     * @param {{ trx?: import('knex').Knex.Transaction }} [options]
     */
    async bulkSaveAssignHistory(originalCases, values, { trx } = {}) {
        try {
            const now = new Date().toISOString();
            const changedAttributes = {
                grupo_id: values.grupo_id,
                ...(values.responsable_id !== undefined && { responsable_id: values.responsable_id }),
                updated_at: values.updated_at,
                updated_by: values.updated_by,
                update_source: values.update_source,
                ...(values.assignment_change_type !== undefined && {
                    assignment_change_type: values.assignment_change_type,
                }),
                ...(values.edited_by !== undefined && { edited_by: values.edited_by }),
                ...(values.edited_at !== undefined && { edited_at: values.edited_at }),
            };
            const records = originalCases.map((kase) => ({
                id: uuidV4(),
                entity_id: kase.id,
                changed_attributes: JSON.stringify(changedAttributes),
                new_attributes: JSON.stringify({ ...kase, ...values }),
                original_attributes: JSON.stringify(kase),
                created_at: now,
                created_by: values.updated_by,
            }));
            await (trx ? this.trxTable(trx, 'history_cases') : this.table('history_cases')).insert(records);
        } catch (error) {
            Helper.logError('Error in bulkSaveAssignHistory', error);
            throw new QueryDBError('bulkSaveAssignHistory');
        }
    }

    /**
     * Builds the case context object used by TransitionRuleValidator.
     * Equivalent to KnexActionRepository.getCasoInfo() but available on the case repository.
     * @param {Case} kase - The case entity (must have .id.value, .cliente_id.value, etc.)
     * @returns {Promise<Object>}
     */
    async getCasoInfo(kase) {
        try {
            if (!kase) return null;

            const aux_casos = await this.table('aux_cases')
                .where({ caso_id: kase.id.value })
                .select('data as aux_cases')
                .first();
            const clientes = await this.table('clients').where({ id: kase.cliente_id.value }).select('*').first();
            const aux_clientes = await this.table('aux_clients')
                .where({ cliente_id: kase.cliente_id.value })
                .select('data as aux_clients')
                .first();
            const clasificaciones = await this.table('clasificaciones')
                .where({ id: kase.clasificacion_id.value })
                .select('*')
                .first();
            const estados = await this.table('transiciones')
                .leftJoin(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                .where({ 'transiciones.id': kase.transicion_id.value })
                .select('estados.id', 'estados.nombre')
                .first();

            if (clasificaciones) {
                const descriptionParts = Array.from({ length: 10 }, (_, i) => clasificaciones[`nivel${i + 1}`]).filter(
                    Boolean
                );
                clasificaciones.description = descriptionParts.join(' -> ');
            }

            return {
                cases: kase.toJson(),
                clients: clientes,
                ...aux_casos,
                ...aux_clientes,
                clasificaciones: clasificaciones,
                estados: {
                    id: estados?.id,
                    nombre: estados?.nombre,
                },
            };
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('custom', 'Transaction failed: error retrieving case information.');
        }
    }

    /**
     * Nombres visibles de las entidades que cita el diagnóstico de una regla de transición.
     * Un id que no existe no aparece en el resultado.
     *
     * @param {{ users?: string[], groups?: string[], states?: string[], classifications?: string[] }} idsByEntity
     * @returns {Promise<Object<string, Object<string, string>>>} `{ users: { [id]: nombre }, … }`
     */
    async findReferenceLabels(idsByEntity) {
        const LEVELS = Array.from({ length: 10 }, (_, i) => `nivel${i + 1}`);
        const joinParts = (row, columns, separator) =>
            columns
                .map((column) => row[column])
                .filter((part) => part != null && String(part).trim() !== '')
                .join(separator);

        const sources = {
            users: { table: 'usuarios', columns: ['nombres', 'apellido1', 'apellido2'], separator: ' ' },
            groups: { table: 'grupos', columns: ['nombre'], separator: ' ' },
            states: { table: 'estados', columns: ['nombre'], separator: ' ' },
            classifications: { table: 'clasificaciones', columns: LEVELS, separator: ' -> ' },
        };

        const entries = await Promise.all(
            Object.entries(idsByEntity)
                .filter(([entity, ids]) => sources[entity] && ids?.length > 0)
                .map(async ([entity, ids]) => {
                    const { table, columns, separator } = sources[entity];
                    const rows = await this.table(table)
                        .whereIn('id', ids)
                        .select('id', ...columns);

                    return [
                        entity,
                        Object.fromEntries(rows.map((row) => [row.id, joinParts(row, columns, separator)])),
                    ];
                })
        );

        return Object.fromEntries(entries);
    }

    /**
     * Builds transition-rule context from an existing case id.
     * Keeps the same context shape used by TransitionRuleValidator.
     * @param {ValueObjectUuid} caseId
     * @returns {Promise<Object|null>}
     */
    async getCaseContextById(caseId) {
        try {
            const kase = await this.table('cases').where({ id: caseId.value }).select('*').first();
            if (!kase) {
                return null;
            }

            const [clientes, aux_casos, aux_clientes, clasificaciones, estados] = await Promise.all([
                this.table('clients').where({ id: kase.cliente_id }).select('*').first(),
                this.table('aux_cases').where({ caso_id: caseId.value }).select('data as aux_cases').first(),
                this.table('aux_clients').where({ cliente_id: kase.cliente_id }).select('data as aux_clients').first(),
                this.table('clasificaciones').where({ id: kase.clasificacion_id }).select('*').first(),
                this.table('transiciones')
                    .leftJoin(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                    .where({ 'transiciones.id': kase.transicion_id })
                    .select('estados.id', 'estados.nombre')
                    .first(),
            ]);

            if (clasificaciones) {
                const descriptionParts = Array.from({ length: 10 }, (_, i) => clasificaciones[`nivel${i + 1}`]).filter(
                    Boolean
                );
                clasificaciones.description = descriptionParts.join(' -> ');
            }

            return {
                cases: { ...kase },
                clients: clientes ?? {},
                aux_cases: aux_casos?.aux_cases ?? {},
                aux_clients: aux_clientes?.aux_clients ?? {},
                clasificaciones: clasificaciones ?? {},
                estados: {
                    id: estados?.id,
                    nombre: estados?.nombre,
                },
            };
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('custom', 'Transaction failed: error building context from case id.');
        }
    }

    /**
     * Builds the case context from a DTO (when the case does not yet exist in DB).
     * Used by TransitionRuleValidator during case creation.
     * @param {Object} dto - The case DTO
     * @returns {Promise<Object>}
     */
    async buildCaseContextFromDto(dto) {
        try {
            const [clientes, clasificaciones, aux_clientes, estados] = await Promise.all([
                dto.cliente_id
                    ? this.table('clients').where({ id: dto.cliente_id }).select('*').first()
                    : Promise.resolve(null),
                dto.clasificacion_id
                    ? this.table('clasificaciones').where({ id: dto.clasificacion_id }).select('*').first()
                    : Promise.resolve(null),
                dto.cliente_id
                    ? this.table('aux_clients')
                          .where({ cliente_id: dto.cliente_id })
                          .select('data as aux_clients')
                          .first()
                    : Promise.resolve(null),
                dto.transicion_id
                    ? this.table('transiciones')
                          .leftJoin(this.qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                          .where({ 'transiciones.id': dto.transicion_id })
                          .select('estados.id', 'estados.nombre')
                          .first()
                    : Promise.resolve(null),
            ]);

            if (clasificaciones) {
                const descriptionParts = Array.from({ length: 10 }, (_, i) => clasificaciones[`nivel${i + 1}`]).filter(
                    Boolean
                );
                clasificaciones.description = descriptionParts.join(' -> ');
            }

            return {
                cases: { ...dto },
                clients: clientes ?? {},
                clasificaciones: clasificaciones ?? {},
                aux_cases: {},
                aux_clients: aux_clientes?.aux_clients ?? {},
                estados: {
                    id: estados?.id,
                    nombre: estados?.nombre,
                },
            };
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('custom', 'Transaction failed: error building case context from dto.');
        }
    }

    /**
     * One round-trip for all five stale-snapshot fields. `undefined` when the case does not exist.
     *
     * @param {string} caseId
     * @returns {Promise<{ transicionId: string|null, responsableId: string|null, clienteId: string|null, clasificacionId: string|null, grupoId: string|null }|undefined>}
     */
    async getStaleSnapshotFields(caseId) {
        try {
            const row = await this.table()
                .select('transicion_id', 'responsable_id', 'cliente_id', 'clasificacion_id', 'grupo_id')
                .where({ id: caseId })
                .first();
            if (!row) {
                return undefined;
            }
            return {
                transicionId: row.transicion_id ?? null,
                responsableId: row.responsable_id ?? null,
                clienteId: row.cliente_id ?? null,
                clasificacionId: row.clasificacion_id ?? null,
                grupoId: row.grupo_id ?? null,
            };
        } catch (error) {
            Helper.logError('Error getting case stale snapshot fields', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Null snapshots match a null column (`WHERE column IS NULL`), same as PostgreSQL
     * `IS NOT DISTINCT FROM`. Column names are validated by the public method.
     *
     * @param {'responsable_id'|'transicion_id'|'cliente_id'|'clasificacion_id'|'grupo_id'} column
     * @param {string} caseId
     * @param {string|null} snapshot
     * @param {string|null} newValue
     * @returns {Promise<boolean>}
     */
    async #updateColumnIfSnapshotMatches(column, caseId, snapshot, newValue, trx) {
        DbRequestContext.markWrite();
        let query = (trx ? this.trxTable(trx) : this.table()).where({ id: caseId }).whereNull('deleted_at');
        if (snapshot === null) {
            query = query.whereNull(column);
        } else {
            query = query.where(column, snapshot);
        }
        const values = { [column]: newValue };
        if (column === 'transicion_id') {
            values.estado_id = this.#estadoIdFromTransition(newValue, trx);
        }
        const affected = await query.update(values);
        return affected > 0;
    }

    /**
     * Snapshot-conditional write of an allowed case base column.
     *
     * @param {'responsable_id'|'transicion_id'|'cliente_id'|'clasificacion_id'|'grupo_id'} column
     * @param {string} caseId
     * @param {string|null} snapshot
     * @param {string|null} newValue
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<boolean>} true when one live row was updated
     */
    async updateColumnIfSnapshotMatches(column, caseId, snapshot, newValue, trx) {
        if (!STALE_SNAPSHOT_COLUMNS.includes(column)) {
            throw new InvalidArgumentError(
                `updateColumnIfSnapshotMatches received column "${column}" not in STALE_SNAPSHOT_COLUMNS`
            );
        }
        DbRequestContext.markWrite();
        try {
            return await this.#updateColumnIfSnapshotMatches(column, caseId, snapshot, newValue, trx);
        } catch (error) {
            Helper.logError(`Error updating case ${column}`, error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Writes only audit columns without loading the aggregate.
     *
     * @param {string} caseId
     * @param {{ updated_at: string|Date, updated_by: string }} audit
     * @returns {Promise<void>}
     */
    async touchUpdatedAt(caseId, { updated_at, updated_by }) {
        DbRequestContext.markWrite();
        try {
            const affected = await this.table()
                .where({ id: caseId })
                .whereNull('deleted_at')
                .update({ updated_at, updated_by });
            if (affected === 0) {
                throw new CustomError('The Case you are trying update does not exist', 404);
            }
        } catch (error) {
            if (error instanceof CustomError) {
                throw error;
            }
            Helper.logError('Error touching case updated_at', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds the last non-default-assignee responsible user for a case by inspecting its history.
     * Iterates history_cases descending and returns the first `responsable_id` that does NOT
     * belong to a user with the DEFAULT_ASSIGNEE external code.
     *
     * @param {string} caseId
     * @returns {Promise<string|null>}
     */
    async getPrioritizedCandidateId(caseId) {
        try {
            const lastChanges = await this.table('history_cases')
                .select('new_attributes')
                .where({ entity_id: caseId })
                .andWhere((builder) => {
                    builder
                        .whereRaw(`COALESCE(NULLIF(BTRIM(changed_attributes::text), ''), '{}') IN ('{}', 'null')`)
                        .orWhereRaw(`changed_attributes->>'responsable_id' IS NOT NULL`);
                })
                .orderBy('created_at', 'desc');

            if (!lastChanges.length) {
                return null;
            }

            const responsibleIds = lastChanges
                .map((change) => change.new_attributes?.responsable_id)
                .filter(Boolean)
                .map((id) => String(id));

            if (!responsibleIds.length) {
                return null;
            }

            const uniqueResponsibleIds = [...new Set(responsibleIds)];
            const defaultAssigneePattern = '%DEFAULT_ASSIGNEE%';

            const eligibleUsers = await this.table('usuarios')
                .select('id')
                .whereIn('id', uniqueResponsibleIds)
                .where('is_active', 1)
                .whereNull('deleted_at')
                .whereNull('deleted_by')
                .whereRaw(`COALESCE(codigos_externos::text, '') NOT ILIKE ?`, [defaultAssigneePattern]);

            if (!eligibleUsers.length) {
                return null;
            }

            const eligibleIds = new Set(eligibleUsers.map((user) => String(user.id)));

            for (const responsibleId of responsibleIds) {
                if (eligibleIds.has(responsibleId)) {
                    return responsibleId;
                }
            }

            return null;
        } catch (error) {
            Helper.logError('Error finding prioritized candidate for case', error);
            throw new QueryDBError('getPrioritizedCandidateId');
        }
    }

    /**
     * Apply a batch of SLA column updates in a single SQL statement.
     *
     * For inputs above SUB_BATCH_SIZE rows, splits internally into sequential sub-batches
     * to stay well below the Postgres parameter limit (~65k); each sub-batch executes one
     * SQL statement. Caller-visible behavior is unchanged: one logical "bulk update".
     *
     * @param {Array<{ id: string, changedAttributes: Record<string, any> }>} updates
     * @returns {Promise<void>}
     */
    async bulkUpdateSlaTimers(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
            return;
        }

        if (updates.length > SUB_BATCH_SIZE) {
            for (let i = 0; i < updates.length; i += SUB_BATCH_SIZE) {
                await this.bulkUpdateSlaTimers(updates.slice(i, i + SUB_BATCH_SIZE));
            }
            return;
        }

        // Validate whitelist and collect the set of columns actually touched across the
        // batch in a single pass — we only generate CASE expressions for columns that at
        // least one update writes.
        const touchedColumns = new Set();
        for (const u of updates) {
            for (const col of Object.keys(u.changedAttributes ?? {})) {
                if (!SLA_UPDATABLE_COLUMNS.includes(col)) {
                    throw new InvalidArgumentError(
                        `bulkUpdateSlaTimers received column "${col}" not in SLA_UPDATABLE_COLUMNS`
                    );
                }
                touchedColumns.add(col);
            }
        }
        if (touchedColumns.size === 0) {
            return;
        }

        const ids = updates.map((u) => u.id);
        const setClauses = [];
        const bindings = [];

        for (const col of touchedColumns) {
            // CASE id WHEN ? THEN ? WHEN ? THEN ? ... ELSE <col> END
            let caseExpr = `"${col}" = CASE "id"`;
            for (const u of updates) {
                if (Object.prototype.hasOwnProperty.call(u.changedAttributes ?? {}, col)) {
                    caseExpr += ' WHEN ? THEN ?';
                    bindings.push(u.id, u.changedAttributes[col]);
                }
            }
            caseExpr += ` ELSE "${col}" END`;
            setClauses.push(caseExpr);
        }

        setClauses.push('"updated_at" = NOW()');

        const idPlaceholders = ids.map(() => '?').join(', ');
        const sql = `
        UPDATE ${this.qualifiedName()}
        SET ${setClauses.join(', ')}
        WHERE "id" IN (${idPlaceholders})
          AND "deleted_at" IS NULL
    `;

        try {
            await this.connection.raw(sql, [...bindings, ...ids]);
        } catch (error) {
            Helper.logError('bulkUpdateSlaTimers failed', error);
            throw new QueryDBError('update');
        }
    }
}
