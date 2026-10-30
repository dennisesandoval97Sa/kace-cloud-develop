import { BoardCollectionResponse } from '@kace/core/src/boards/application/BoardCollectionResponse';
import { KnexBoardResourcesRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardResourcesRepository';
import { Counter, Criteria, Helper } from '@kace/core/src/shared';
import { BoardResourcesCollectionResponse } from '../BoardResourcesCollectionResponse.js';
import { BoardCriteriaFormat } from '../../domain/BoardCriteriaFormat.js';
import { applyCaseInsensitiveOrders } from '../../domain/applyCaseInsensitiveOrders.js';
import { AUX_SPECIALIZED_FK } from '@kace/core/src/auxiliaries/domain/AuxFkMapping';
import { BoardUnifiedStatusPolicy } from '../../domain/BoardUnifiedStatusPolicy.js';
import { BoardAnsFilterPolicy } from '../../domain/BoardAnsFilterPolicy.js';
import { ALLOWED_CRITERIA_FUNCTIONS } from '../../../shared/criteria/allowedCriteriaFunctions.js';
import { isCasesLikeEntity } from '../../domain/isCasesLikeEntity.js';
import { SchemaMetadataCache } from '@kace/core/src/shared';

export class BoardResourcesSearch {
    /** @type {KnexBoardResourcesRepository} is initialized in the constructor */
    #repository;

    /** @type {Counter} is initialized in the constructor */
    #counter;

    /** @type {BoardCriteriaFormat} is initialized in the constructor */
    #criteriaFormatter;

    /**
     * @param {KnexBoardResourcesRepository} repository
     * @param tablename
     */
    constructor(repository, tablename) {
        this.#repository = repository;
        this.#repository.tableName = tablename;
        this.#counter = new Counter(repository);
        this.#criteriaFormatter = new BoardCriteriaFormat();
    }

    /**
     * Busca Board según los criterios dados y retorna una colección estándar.
     * @param {Object} dtoCriteria - Criterios de búsqueda (filter, relationship, limit, offset, order)
     * @returns {Promise<BoardCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const { limit, offset, orders, tableName } = dtoCriteria;

        let selectColumns = this.#criteriaFormatter.buildSelectColumns(dtoCriteria.select);

        let relationships = [];
        if (dtoCriteria.relationship && Array.isArray(dtoCriteria.relationship)) {
            relationships = this.#criteriaFormatter.buildRelationships(dtoCriteria.relationship);
        }

        let filters = null;
        if (dtoCriteria.filter && Array.isArray(dtoCriteria.filter)) {
            const sanitizedBase = BoardAnsFilterPolicy.stripFilters(dtoCriteria.filter, dtoCriteria.select);
            const expandedBase = BoardUnifiedStatusPolicy.expandFilters(
                sanitizedBase,
                dtoCriteria.select,
                dtoCriteria.tableName
            );
            filters = this.#criteriaFormatter.buildFilters(expandedBase);
        }

        let groupByColumns = dtoCriteria.select.filter((col) => col.group_by === true && col.function === null);
        if (groupByColumns.length > 0) {
            groupByColumns = groupByColumns.map((col) => `${col.entity}.${col.field}`);
            const concatCols = dtoCriteria.select.filter(
                (col) => col.function === ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT
            );
            concatCols.forEach((col) => {
                (col.concat_sources ?? []).forEach((source) => {
                    const sourceField = `${source.entity}.${source.field}`;
                    if (!groupByColumns.includes(sourceField)) {
                        groupByColumns.push(sourceField);
                    }
                });
            });
        } else {
            selectColumns = [`${tableName}.id as id`, ...selectColumns];
            groupByColumns = null;
        }

        if (isCasesLikeEntity(tableName) && groupByColumns === null) {
            selectColumns = await this.#appendCasesBulkHiddenFields(selectColumns, tableName);
        }

        if (tableName.startsWith('aux_') && groupByColumns === null) {
            selectColumns = BoardResourcesSearch.#appendAuxFkHiddenField(tableName, selectColumns);
        }

        let having = null;
        if (dtoCriteria.having && Array.isArray(dtoCriteria.having)) {
            having = this.#criteriaFormatter.buildHavings(dtoCriteria.having);
        }

        const hasSubQuery = !!dtoCriteria.subQuery;

        // Apply case-insensitive sorting for STRING type columns
        applyCaseInsensitiveOrders(orders, dtoCriteria.select);

        const criteria = new Criteria(
            filters,
            relationships,
            hasSubQuery ? null : limit,
            hasSubQuery ? null : offset,
            orders,
            tableName,
            selectColumns,
            groupByColumns,
            having
        );

        // FIX: limit y offset son una unidad semántica inseparable para la paginación.
        // El front siempre envía { limit: 0, offset: 0 } en el body cuando hay filtros activos,
        // y la paginación real viene por query param (?page=N → offset calculado en el controller).
        // Si se evalúan independientemente, offset: 0 !== undefined era true y sobreescribía
        // el offset del board, causando que ?page=2 siempre devolviera página 1.
        const subQueryHasPagination =
            hasSubQuery && dtoCriteria.subQuery.limit !== undefined && dtoCriteria.subQuery.limit !== 0;

        const subQuery = hasSubQuery
            ? {
                  ...dtoCriteria.subQuery,
                  limit: subQueryHasPagination ? dtoCriteria.subQuery.limit : limit,
                  offset: subQueryHasPagination ? (dtoCriteria.subQuery.offset ?? 0) : offset,
                  filter: Array.isArray(dtoCriteria.subQuery?.filter)
                      ? BoardUnifiedStatusPolicy.expandFilters(
                            BoardAnsFilterPolicy.stripFilters(dtoCriteria.subQuery.filter, dtoCriteria.select),
                            dtoCriteria.select,
                            't'
                        )
                      : dtoCriteria.subQuery?.filter,
              }
            : dtoCriteria.subQuery;

        // Apply case-insensitive sorting for subQuery orders (supports both array and single object)
        if (hasSubQuery && subQuery?.order) {
            applyCaseInsensitiveOrders(subQuery.order, dtoCriteria.select);
        }

        const rows = await this.#repository.search(criteria, subQuery);

        let countResult;
        if (hasSubQuery) {
            const countCriteriaInner = new Criteria(
                filters,
                relationships,
                null,
                null,
                orders,
                tableName,
                selectColumns,
                groupByColumns,
                having
            );
            const countRow = await this.#repository.countWithSubQuery(countCriteriaInner, subQuery);
            countResult = parseInt(countRow.count || countRow['count(*)'], 10);
        } else {
            const dtoCriteriaFormat = {
                filter: filters,
                relationship: relationships,
                limit,
                offset,
                orders,
                tableName: tableName,
            };
            const count = await this.#counter.execute(dtoCriteriaFormat);
            countResult = parseInt(count.count || count['count(*)'], 10);
        }

        // Reutiliza subQueryHasPagination para calcular currentPage/totalPages
        // de forma consistente con la paginación aplicada en la query.
        const effectiveLimit = subQueryHasPagination ? dtoCriteria.subQuery.limit : limit;
        const effectiveOffset = subQueryHasPagination ? (dtoCriteria.subQuery.offset ?? 0) : offset;

        const currentPage = Math.floor((effectiveOffset || 0) / (effectiveLimit || 1)) + 1;
        const totalPages = Math.ceil(countResult / effectiveLimit);

        this.#criteriaFormatter.formatRows(rows.rows);

        let countByStatus = [];
        if (tableName === 'cases') {
            const countCriteria = new Criteria(filters, relationships, null, 0, null, tableName);
            if (hasSubQuery) {
                const countStatusCriteria = new Criteria(
                    filters,
                    relationships,
                    null,
                    null,
                    orders,
                    tableName,
                    selectColumns,
                    groupByColumns,
                    having
                );
                countByStatus = await this.#repository.searchCountByStatusWithSubQuery(
                    countStatusCriteria,
                    subQuery,
                    groupByColumns !== null
                );
            } else {
                countByStatus = await this.#repository.searchCountByStatus(countCriteria);
            }
        }

        const ansField = BoardResourcesSearch.#resolveAnsField(dtoCriteria);
        let countByAns = null;
        if (ansField) {
            try {
                // countByAns es siempre global: ignora subQuery (filtros del usuario)
                // y se calcula solo sobre los filtros base del board.
                const rawCountByAns = await this.#repository.searchCountByAns(
                    new Criteria(filters, relationships, null, 0, null, tableName),
                    ansField
                );

                countByAns = [1, 2, 3].map((id) => ({
                    id,
                    count: rawCountByAns.find((r) => r.id === id)?.count ?? 0,
                }));
            } catch (error) {
                // A misconfigured quick_ans_filter must not break the main resources response.
                Helper.logError('countByAns skipped due to error', error);
                countByAns = null;
            }
        }

        const response = new BoardResourcesCollectionResponse(
            rows,
            countResult,
            currentPage,
            totalPages,
            countByStatus,
            countByAns
        );
        return response;
    }

    /**
     * Resolve the fully-qualified ANS field (entity.field) based on the board's quick_ans_filter
     * configuration. Returns null when the feature is disabled or the alias cannot be matched
     * to an is_ans column in the board's select list.
     * @param {Object} dtoCriteria
     * @returns {string|null}
     */
    static #resolveAnsField(dtoCriteria) {
        const config = dtoCriteria.quickAnsFilter;
        if (!config || config.enabled !== true) return null;
        const alias = config.ans_column_alias;
        if (!alias) return null;

        const columns = Array.isArray(dtoCriteria.select) ? dtoCriteria.select : [];
        const ansColumn = columns.find((c) => c?.is_ans === true && c?.alias === alias);
        if (!ansColumn || !ansColumn.entity || !ansColumn.field || ansColumn.function) return null;

        return `${ansColumn.entity}.${ansColumn.field}`;
    }

    /**
     * FK columns for known specialized aux tables.
     * These ensure the FK field is always in the board resources response so the
     * frontend can reliably detect main-entity dependencies for delete validation.
     */
    static #AUX_FK_HIDDEN_FIELDS = Object.fromEntries(
        Object.entries(AUX_SPECIALIZED_FK).map(([table, { fkColumn }]) => [table, `${table}.${fkColumn}`])
    );

    static #appendAuxFkHiddenField(tableName, selectColumns) {
        const fkField = BoardResourcesSearch.#AUX_FK_HIDDEN_FIELDS[tableName];
        if (!fkField) return selectColumns;
        const flat = selectColumns
            .map((c) => (typeof c === 'string' ? c : `${c.entity ?? ''}.${c.field ?? ''} ${c.alias ?? ''}`))
            .join(' ');
        if (flat.includes(fkField)) return selectColumns;
        return [...selectColumns, fkField];
    }

    /**
     * Appends the hidden eligibility columns (`fecha_resolucion`, `transicion_id`) the frontend
     * bulk-action UX relies on. For the real `cases` table both always exist; for a cases-like
     * view each is appended only when the view actually exposes it, so the query never references
     * a non-existent column on legacy/inconsistent views.
     * @param {Array} selectColumns
     * @param {string} tableName
     * @returns {Promise<Array>}
     */
    async #appendCasesBulkHiddenFields(selectColumns, tableName) {
        const flat = selectColumns
            .map((c) => (typeof c === 'string' ? c : `${c.field ?? ''} ${c.alias ?? ''}`))
            .join(' ');

        let availableColumns = null;
        if (tableName !== 'cases') {
            availableColumns = await SchemaMetadataCache.getTableColumns(this.#repository.connection, tableName);
        }
        const exposes = (column) => availableColumns === null || availableColumns.includes(column);

        const next = [...selectColumns];
        if (!flat.includes(`${tableName}.fecha_resolucion`) && exposes('fecha_resolucion')) {
            next.push(`${tableName}.fecha_resolucion`);
        }
        if (!flat.includes(`${tableName}.transicion_id`) && exposes('transicion_id')) {
            next.push(`${tableName}.transicion_id`);
        }
        return next;
    }
}
