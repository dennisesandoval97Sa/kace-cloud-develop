import { ValueObjectInt } from '../domain/value-object/ValueObjectInt';
import { CriteriaAndCondition } from './CriteriaAndCondition';
import { CriteriaOrCondition } from './CriteriaOrCondition';
import { FilterByRelationship } from './FilterByRelationship';
import { COMPARISION_OPERATORS } from './FilterOperator';
import { Filters } from './Filters';
import { FILTER_TYPE } from './FilterType';
import { OrderByCriteria } from './OrderByCriteria';
import { RELATIONSHIPS_TYPES } from './RelationshipType';
import { VOHavingByCriteria } from './VOHavingByCriteria';
import { VOSelectByCriteria } from './VOSelectByCriteria.js';
import { ValueObjectBoolean } from '../domain/value-object/ValueObjectBoolean.js';
import { ALLOWED_CRITERIA_FUNCTIONS } from './allowedCriteriaFunctions.js';
import { AuxiliaryColumnFieldHelper } from './AuxiliaryColumnFieldHelper.js';
import { JsonbPathHelper } from './JsonbPathHelper.js';
import { AuxiliaryEntityHelper } from './AuxiliaryEntityHelper.js';
import { parseJsonPathDateBetweenValue } from './JsonPathDateBetween.js';
export class Criteria {
    /** @type {Array} is initialized in the constructor */
    #filters;
    /** @type {Array} is initialized in the constructor */
    #relationship;
    /** @type {Number} is initialized in the constructor */
    #limit;
    /** @type {Number} is initialized in the constructor */
    #offset;
    /** @type {String} is initialized in the constructor */
    #order;
    /** @type {String|null} is initialized in the constructor */
    #tablename;
    /** @type {Array} is initialized in the constructor */
    #select;
    /** @type {Array} is initialized in the constructor */
    #groupBy;
    /** @type {Array} is initialized in the constructor */
    #having;
    /** @type {Boolean} is initialized in the constructor */
    #distinct;

    #allowedTables;
    /**
     *
     * @param {array|null|undefined} filters
     * @param {array|null|undefined} relationship
     * @param {number|null|undefined} limit
     * @param {number|null|undefined} offset
     * @param {object|null|undefined} order
     * @param {string|null|undefined} tablename
     * @param {array|null|undefined} having
     *
     */
    constructor(
        filters,
        relationship,
        limit,
        offset,
        order,
        tablename,
        select = null,
        group_by = null,
        having = null,
        distinct = false
    ) {
        this.#filters = !filters ? filters : Filters.fromValues(filters, tablename);
        this.#relationship = !relationship ? relationship : FilterByRelationship.fromValues(relationship);
        this.#limit = !limit ? null : new ValueObjectInt('limit', limit);
        this.#offset = !offset ? null : new ValueObjectInt('offset', offset, true);
        this.#order = !order ? null : new OrderByCriteria(order);
        this.#tablename = tablename ?? null;

        this.#allowedTables = this.#extractAllowedTables(tablename, relationship);

        this.#select = new VOSelectByCriteria('criteria select', select, true, this.#allowedTables);
        this.#groupBy = new VOSelectByCriteria('criteria group by', group_by, true, this.#allowedTables);
        this.#having = new VOHavingByCriteria('criteria having', having, true);
        this.#distinct = new ValueObjectBoolean('criteria distinct', distinct, true);
    }

    get limit() {
        return this.#limit.value;
    }

    get offset() {
        return this.#offset.value;
    }

    get order() {
        return this.#order.value;
    }

    get relationship() {
        return this.#relationship?.relationship;
    }

    get tablename() {
        return this.#tablename;
    }

    get filters() {
        return this.#filters;
    }

    setTableColumns(columnsInfo) {
        this._columnsInfo = columnsInfo;
    }
    /**
     *
     * @param {QueryBuilder} knexQuery
     * @returns {QueryBuilder}
     */
    convertToKnex(knexQuery) {
        const validHavingColumns = [];
        const validGroupColumns = [];
        const rawGroupByFields = [];
        this.#groupBy?.value?.forEach((groupByItem) => {
            const groupTablePart = groupByItem.split('.')[0];
            if (AuxiliaryEntityHelper.isAuxiliaryField(groupTablePart)) {
                return;
            }
            validGroupColumns.push(groupByItem);
        });
        const groupByFields = new Set(validGroupColumns);
        if (this.#select.value) {
            knexQuery.clearSelect();
            const select = [];
            this.#select.value.forEach((selectItem) => {
                if (typeof selectItem === 'object') {
                    if (AuxiliaryEntityHelper.isAuxiliaryField(selectItem.field)) {
                        if (
                            Object.values(ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions).includes(selectItem.function)
                        ) {
                            const parts = selectItem.field.split('.');
                            const auxiliary = parts.shift();
                            const jsonPath = `'{${parts.join(',')}}'`;
                            knexQuery.select(
                                knexQuery.client.raw(
                                    `${selectItem.function}(${auxiliary}.data #>> ${jsonPath}) as ??`,
                                    [selectItem.alias]
                                )
                            );
                            validHavingColumns.push(`${selectItem.function}(${auxiliary}.data #>> ${jsonPath})`);
                            return;
                        }
                    }
                    if (Object.values(ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions).includes(selectItem.function)) {
                        validHavingColumns.push(`${selectItem.function}(${selectItem.field})`);
                    }
                    switch (selectItem.function) {
                        case ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE:
                            const items = selectItem.field.split('::: ');
                            knexQuery.select(
                                knexQuery.client.raw(`EXTRACT(EPOCH FROM (${items[1]} - ${items[0]})) as ??`, [
                                    selectItem.alias,
                                ])
                            );
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT:
                            knexQuery.select(
                                knexQuery.client.raw(`CONCAT(${selectItem.field}) as ??`, [selectItem.alias])
                            );
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.SUM:
                            knexQuery.sum(selectItem.field, { as: selectItem.alias });
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.AVG:
                            knexQuery.avg(selectItem.field, { as: selectItem.alias });
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.MIN:
                            knexQuery.min(selectItem.field, { as: selectItem.alias });
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.MAX:
                            knexQuery.max(selectItem.field, { as: selectItem.alias });
                            break;
                        case ALLOWED_CRITERIA_FUNCTIONS.aggregate_functions.COUNT:
                        default:
                            knexQuery.count(selectItem.field, { as: selectItem.alias });
                            break;
                    }
                } else if (this.#isAuxiliarySelect(selectItem)) {
                    const parts = selectItem.split(' as ');
                    const alias = parts[1];
                    const selectPathParts = parts[0].trim().split('.');
                    const fieldName = selectPathParts[1];
                    if (
                        selectPathParts.length > 1 &&
                        fieldName !== 'id' &&
                        !AuxiliaryColumnFieldHelper.isColumnField(fieldName, selectPathParts[0])
                    ) {
                        const auxiliary = selectPathParts[0];
                        const pathParts = selectPathParts.slice(1);
                        const jsonSelectSql = this.#buildAuxiliaryJsonSelectSql(auxiliary, pathParts);
                        if (
                            !!this.#groupBy.value ||
                            validHavingColumns.length > 0 ||
                            (this.#having?.value && this.#having.value.length)
                        ) {
                            rawGroupByFields.push(knexQuery.client.raw(jsonSelectSql));
                        }
                        select.push(knexQuery.client.raw(`${jsonSelectSql} as ??`, [alias ? alias : fieldName]));
                    } else {
                        select.push(selectItem);
                    }
                } else {
                    select.push(selectItem);
                }
            });

            if (this.#distinct.value && (!this.#groupBy?.value || this.#groupBy.value.length === 0)) {
                knexQuery.distinct(select);
            } else {
                knexQuery.select(select);
            }
        }

        const isValidToGroupBy =
            !!this.#groupBy.value ||
            validHavingColumns.length > 0 ||
            (this.#having?.value && this.#having.value.length);

        this.#relationship?.relationship?.forEach((relation) => {
            this.#buildRelation(knexQuery, relation.toPrimitives());
        });

        this.#filters?.filters?.forEach((filter, index) => {
            if (filter.isBoardUnifiedSqlWhere) {
                const isOr = String(filter.type || 'AND').toUpperCase() === 'OR';
                if (index === 0) {
                    knexQuery.whereRaw(filter.sql);
                } else if (isOr) {
                    knexQuery.orWhereRaw(filter.sql);
                } else {
                    knexQuery.andWhereRaw(filter.sql);
                }
                return;
            }
            if (filter?.value?.value && filter.value.value.function) {
                const fnName = filter.value.value.function;
                if (
                    fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.DATE_CALCULATED_ADD ||
                    fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.DATE_CALCULATED_SUBTRACT
                ) {
                    const operation =
                        fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.DATE_CALCULATED_ADD
                            ? 'add'
                            : 'substract';
                    this.#applyDateCalculatedFilter(knexQuery, filter, operation);
                }
                if (fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.LOGGED_IN_USER) {
                    this.#applyLoggedInUserFilter(knexQuery, filter);
                }
                if (fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.LOGGED_IN_USER_GROUP) {
                    this.#applyLoggedInUserFilter(knexQuery, filter);
                }
                if (fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.ACTIVE_CLIENT) {
                    this.#applyLoggedInUserFilter(knexQuery, filter);
                }
                if (fnName === ALLOWED_CRITERIA_FUNCTIONS.conditional_functions.RECENT_DATE) {
                    this.#applyRecentDateFilter(knexQuery, filter);
                }
            } else if (filter.groupType && filter.filters) {
                const method = filter.groupType === 'OR' ? (index === 0 ? 'where' : 'orWhere') : 'andWhere';
                knexQuery[method]((inner) => {
                    filter.filters.forEach((subFilter, subIndex) => {
                        if (subFilter.isBoardUnifiedSqlWhere) {
                            const isOr = String(subFilter.type || 'AND').toUpperCase() === 'OR';
                            if (subIndex === 0) {
                                inner.whereRaw(subFilter.sql);
                            } else if (isOr) {
                                inner.orWhereRaw(subFilter.sql);
                            } else {
                                inner.andWhereRaw(subFilter.sql);
                            }
                            return;
                        }
                        const isAuxiliary = AuxiliaryEntityHelper.isAuxiliaryField(subFilter.field.value);
                        if (isAuxiliary && subFilter.operator.value !== COMPARISION_OPERATORS.jsonContains) {
                            this.#getBoardsWhereConditions(inner, subFilter);
                        } else {
                            this.#convertCriteriaToKnexQuery(inner, subFilter);
                        }
                    });
                });
            } else {
                const _fieldParts = filter.field.value?.split('.') ?? [];
                const _columnPart = _fieldParts.length === 2 ? _fieldParts[1] : null;
                const isAuxiliary =
                    filter.field.value &&
                    (filter.field.value.startsWith('aux_') ||
                        filter.field.value.startsWith('aux-') ||
                        filter.field.value.includes('case_auxiliar') ||
                        filter.field.value.includes('clients_auxiliar')) &&
                    !filter.field.value.includes('aux_definitions') &&
                    !(_columnPart && AuxiliaryColumnFieldHelper.isColumnField(_columnPart, _fieldParts[0]));
                if (isAuxiliary && filter.operator.value !== COMPARISION_OPERATORS.jsonContains) {
                    this.#getBoardsWhereConditions(knexQuery, filter);
                } else {
                    this.#convertCriteriaToKnexQuery(knexQuery, filter);
                }
            }
        });

        if (this.#limit) {
            knexQuery.limit(this.#limit.value);
        }

        if (this.#offset) {
            knexQuery.offset(this.#offset.value);
        }

        if (this.#order) {
            if (this.#order.orders.length > 1) {
                this.#order.orders.forEach((order) =>
                    this.#processOrder(order, knexQuery, groupByFields, isValidToGroupBy, rawGroupByFields)
                );
            } else {
                this.#processOrder(this.#order, knexQuery, groupByFields, isValidToGroupBy, rawGroupByFields);
            }
        }

        if (isValidToGroupBy && this.#select?.value && this.#select.value.length) {
            this.#select.value.forEach((f) => {
                if (typeof f === 'object') {
                    return;
                }
                const field = f.split(' as ')[0].trim();
                const fieldTablePart = field.split('.')[0];
                const fieldColumnPart = field.split('.')[1];

                const isAux = AuxiliaryEntityHelper.isAuxiliaryField(fieldTablePart);
                if (
                    isAux &&
                    fieldColumnPart !== 'id' &&
                    !fieldColumnPart?.includes('_id') &&
                    !AuxiliaryColumnFieldHelper.isColumnField(fieldColumnPart, fieldTablePart)
                ) {
                    return;
                }
                groupByFields.add(field);
            });
        }

        if (isValidToGroupBy || groupByFields.size > 0 || rawGroupByFields.length > 0) {
            knexQuery.groupBy([...Array.from(groupByFields), ...rawGroupByFields]);
        }

        if (this.#having?.value && this.#having.value.length) {
            const havingColumns = this.#having.value.map((h) => h.column);
            const allColumnsInGroupBy = havingColumns.every(
                (col) => groupByFields.has(col) || validHavingColumns.includes(col)
            );
            if (allColumnsInGroupBy) {
                this.#applyHavingConditions(knexQuery, this.#having.value);
            }
        }

        return knexQuery;
    }

    #convertCriteriaToKnexQuery(knexQuery, filter) {
        this.validateLikeOrIlikeOperator(filter);
        this.validateInNotInOperator(filter);
        this.validateBetweenOperator(filter);
        this.validateJsonContains(filter);
        this.validateJsonArrayValue(filter);
        this.validateJsonPathDateBetween(filter);

        if (filter.type.value === FILTER_TYPE.AND) {
            /**
             * Build query
             */
            return new CriteriaAndCondition(
                filter.operator.value,
                filter.field.value,
                filter.value.value,
                knexQuery,
                this.#order
            ).execute();
        }

        if (filter.type.value === FILTER_TYPE.OR) {
            return new CriteriaOrCondition(
                filter.operator.value,
                filter.field.value,
                filter.value.value,
                knexQuery,
                this.#order
            ).execute();
        }
    }

    #buildRelation(query, relation) {
        // Qualify the joined table with the schema extracted from the query's
        // underlying Knex client config. Without this, dynamic joins built
        // from RELATIONS_LIST emit unqualified table names (e.g. 'aux_cases')
        // and Postgres returns 'relation does not exist' because the
        // search_path is now 'public' (post schema-qualification refactor).
        const tableRef = this.#qualifyRelationTable(query, relation.table.value);
        if (relation.type.value === RELATIONSHIPS_TYPES.join) {
            query.join(tableRef, relation.condition.column.value, relation.condition.refColumn.value);
        }
        if (relation.type.value === RELATIONSHIPS_TYPES.left) {
            query.leftJoin(tableRef, relation.condition.column.value, relation.condition.refColumn.value);
        }
        if (relation.type.value === RELATIONSHIPS_TYPES.right) {
            query.rightJoin(tableRef, relation.condition.column.value, relation.condition.refColumn.value);
        }
    }

    /**
     * Prefixes the relation's table reference with the schema from the query's
     * Knex client config. Supports both bare table names ('aux_cases') and
     * aliased references ('aux_cases as case_auxiliar').
     * If the reference already contains a schema prefix (a dot before any 'as'),
     * it's left as-is.
     */
    #qualifyRelationTable(query, tableRef) {
        const schema = query?.client?.config?.schema;
        if (!schema) return tableRef;
        const [tableName, ...aliasParts] = tableRef.split(/\s+as\s+/i);
        if (tableName.includes('.')) return tableRef; // already qualified
        const qualified = `${schema}.${tableName}`;
        return aliasParts.length > 0 ? `${qualified} as ${aliasParts.join(' as ')}` : qualified;
    }

    /**
     * Applies a logged-in user filter by extracting the user ID from the function
     * wrapper object and delegating to the standard WHERE condition builders.
     *
     * The filter value arrives as: { function: 'logged_in_user', value: '<user_id>' }
     * This method unwraps it to the plain user ID, then generates the appropriate
     * WHERE condition (e.g., WHERE casos.responsable_id = '<user_id>').
     *
     * @param {QueryBuilder} knexQuery - The Knex query builder instance
     * @param {Filter} filter - The filter containing field, operator, value (function object), and type
     */
    #applyLoggedInUserFilter(knexQuery, filter) {
        const functionObject = filter.value.value;
        const userId = functionObject?.value;

        if (userId === null || userId === undefined || userId === '') {
            throw new Error(`logged_in_user filter requires a user ID value. Field: ${filter.field.value}`);
        }

        filter.setValue(userId);

        const isAuxiliary =
            filter.field.value &&
            (filter.field.value.startsWith('aux_') ||
                filter.field.value.startsWith('aux-') ||
                filter.field.value.includes('case_auxiliar') ||
                filter.field.value.includes('clients_auxiliar')) &&
            !filter.field.value.includes('aux_definitions');

        if (isAuxiliary && filter.operator.value !== COMPARISION_OPERATORS.jsonContains) {
            this.#getBoardsWhereConditions(knexQuery, filter);
        } else {
            this.#convertCriteriaToKnexQuery(knexQuery, filter);
        }
    }

    #applyRecentDateFilter(knexQuery, filter) {
        const functionObject = filter.value.value;
        const recentWindowMinutes = Number(functionObject?.value ?? 2);

        if (!Number.isFinite(recentWindowMinutes) || recentWindowMinutes <= 0) {
            throw new Error(
                `recent_date filter requires a positive time window in minutes. Field: ${filter.field.value}`
            );
        }

        const isInactiveFilter = filter.operator.value === COMPARISION_OPERATORS.neq;
        const isOrCondition = filter.type.value === FILTER_TYPE.OR;
        const whereMethod = isOrCondition ? 'orWhereRaw' : 'whereRaw';

        if (isInactiveFilter) {
            knexQuery[whereMethod](`(?? < NOW() - INTERVAL '1 minute' * ? OR ?? IS NULL)`, [
                filter.field.value,
                recentWindowMinutes,
                filter.field.value,
            ]);
            return;
        }

        knexQuery[whereMethod](`?? >= NOW() - INTERVAL '1 minute' * ?`, [filter.field.value, recentWindowMinutes]);
    }

    validateLikeOrIlikeOperator(filter) {
        if (
            filter.operator.value === COMPARISION_OPERATORS.like ||
            filter.operator.value === COMPARISION_OPERATORS.ilike
        ) {
            const value = filter.value.value ?? '';
            filter.setValue(`%${value}%`);
        }
    }

    validateInNotInOperator(filter) {
        if (
            filter.operator.value === COMPARISION_OPERATORS.in ||
            filter.operator.value === COMPARISION_OPERATORS.notIn
        ) {
            filter.setValue(
                filter.value.value
                    .toString()
                    .split(',')
                    .map((item) => item.trim())
            );
        }
    }

    validateBetweenOperator(filter) {
        if (filter.operator.value === COMPARISION_OPERATORS.between) {
            if (Array.isArray(filter.value.value)) {
                const values = filter.value.value;

                if (values.length !== 2) {
                    throw new Error('Invalid between condition, must be two values');
                }

                filter.setValue(values.map((v) => v?.trim?.() ?? v));
                return;
            }

            if (typeof filter.value.value === 'string') {
                const values = filter.value.value.split(',').map((v) => v.trim());

                if (values.length !== 2) {
                    throw new Error('Invalid between condition, must be two values');
                }

                filter.setValue(values);
            }
        }
    }
    validateJsonContains(filter) {
        if (filter.operator.value !== COMPARISION_OPERATORS.jsonContains) {
            return;
        }

        const value = filter.value.value;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) return;

        if (typeof value !== 'string') {
            throw new Error('JsonContains value must be a JSON string');
        }

        try {
            const parsedValue = JSON.parse(value);

            if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
                throw new Error('JsonContains value must be a JSON object');
            }

            filter.setValue(parsedValue);
        } catch {
            throw new Error('Invalid JsonContains value');
        }
    }

    validateJsonPathDateBetween(filter) {
        if (filter.operator.value !== COMPARISION_OPERATORS.jsonPathDateBetween) {
            return;
        }

        filter.setValue(parseJsonPathDateBetweenValue(filter.value.value));
    }

    validateJsonArrayValue(filter) {
        if (filter.operator.value === COMPARISION_OPERATORS.jsonArrayValue) {
            const value = filter.value.value;

            if (Array.isArray(value)) {
                return;
            }

            const values = filter.value.value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);

            filter.setValue(values);
        }
    }

    #extractAllowedTables(tablename, relationship) {
        const allowedtables = tablename ? [tablename] : [];
        if (relationship && Array.isArray(relationship)) {
            relationship.forEach((r) => {
                if (r.table) {
                    const tables = r.table.split(' as ');
                    allowedtables.push(tables[0]);
                    if (tables.length > 1) {
                        allowedtables.push(tables[1]);
                    }
                }
            });
        }
        return allowedtables;
    }

    /**
     * Aplica condiciones HAVING al query, solo si la consulta tiene GROUP BY o agregaciones.
     *
     * @param {QueryBuilder} knexQuery
     * @param {Array<{column: string, operator: string, value: any}>} havingConditions
     * @returns {QueryBuilder}
     */
    #applyHavingConditions(knexQuery, havingConditions = []) {
        if (!Array.isArray(havingConditions) || havingConditions.length === 0) {
            return knexQuery;
        }

        havingConditions.forEach(({ column, operator, value }) => {
            let newColumn;
            if (column.includes('(') && column.includes(')')) {
                newColumn = knexQuery.client.raw(column);
            } else {
                newColumn = column;
            }
            switch (operator) {
                case 'null':
                    knexQuery.havingNull(newColumn);
                    break;
                case 'notNull':
                    knexQuery.havingNotNull(newColumn);
                    break;
                case 'in':
                    knexQuery.havingIn(newColumn, value);
                    break;
                case 'notIn':
                    knexQuery.havingNotIn(newColumn, value);
                    break;
                case 'between':
                    knexQuery.havingBetween(newColumn, value);
                    break;
                default:
                    knexQuery.having(newColumn, COMPARISION_OPERATORS[operator], value);
            }
        });

        return knexQuery;
    }

    #getBoardsWhereConditions(knexQuery, filter) {
        const operator = filter.operator.value;

        const isJsonOp =
            operator === COMPARISION_OPERATORS.jsonContains || operator === COMPARISION_OPERATORS.jsonArrayValue;

        if (isJsonOp) return null;

        this.validateLikeOrIlikeOperator(filter);
        this.validateInNotInOperator(filter);
        this.validateBetweenOperator(filter);
        this.validateJsonContains(filter);
        this.validateJsonArrayValue(filter);

        const value = filter.value.value;

        const rawField = filter.field.value;

        const isSqlExpression =
            rawField.includes(' - ') || rawField.includes(' + ') || rawField.includes('*') || rawField.includes('/');

        if (isSqlExpression) {
            const isOrCondition = filter.type.value === FILTER_TYPE.OR;
            const whereMethod = isOrCondition ? 'orWhereRaw' : 'whereRaw';

            knexQuery[whereMethod](rawField);
            return knexQuery;
        }

        const isJsonSqlExpression = rawField.includes('->') || rawField.includes('#>') || rawField.includes('#>>');

        /**
         * SPLIT FIELD
         * form1.created_at → aux_cases.data #>> '{form1,created_at}'
         */
        const parts = rawField.split('.');

        const table = filter.entity?.value || parts.shift();
        const jsonKeys = parts;

        if (!isJsonSqlExpression && !jsonKeys.length) {
            throw new Error(`Invalid JSON field: ${rawField}`);
        }

        const isOrCondition = filter.type.value === FILTER_TYPE.OR;
        const whereMethod = isOrCondition ? 'orWhereRaw' : 'whereRaw';

        /**
         *  JSONB EXPRESSION CENTRALIZADA
         */
        let jsonExpression;
        if (
            (operator === COMPARISION_OPERATORS.jsonPathEmpty || operator === COMPARISION_OPERATORS.jsonNotPathEmpty) &&
            parts.length === 1 &&
            parts[0] === 'data' &&
            value != null &&
            value !== 'null' &&
            String(value).trim() !== ''
        ) {
            const jsonbPath = String(value).trim();
            jsonExpression = JsonbPathHelper.jsonExtract(table, `${table}.${jsonbPath}`);
        } else {
            jsonExpression = isJsonSqlExpression ? rawField : JsonbPathHelper.jsonExtract(table, rawField);
        }

        /**
         *  TYPE DETECTION (limpio)
         */
        const isDateString = (v) => this.#isAuxiliaryDateFilterString(v);
        const explicitTypeValue = this.#resolveAuxiliaryFilterTypeValue(filter);

        let typeValue = explicitTypeValue ?? 'numeric';

        if (!explicitTypeValue) {
            if (isDateString(value)) {
                typeValue = 'date';
            }

            if (operator === COMPARISION_OPERATORS.between) {
                const [v1, v2] = Array.isArray(value) ? value : [];

                if (isDateString(v1) && isDateString(v2)) {
                    typeValue = 'date';
                }
            }
        }

        const safeDateCastExpr = this.#buildAuxiliaryJsonbTextToTimestamptzExpression(jsonExpression);

        /**
         *  QUERY BUILDER
         */
        switch (operator) {
            case COMPARISION_OPERATORS.eq:
                knexQuery[whereMethod](`${jsonExpression} = ?`, [value.toString()]);
                break;

            case COMPARISION_OPERATORS.neq:
                knexQuery[whereMethod](`${jsonExpression} != ?`, [value.toString()]);
                break;

            case COMPARISION_OPERATORS.gt:
                knexQuery[whereMethod](
                    `${typeValue === 'date' ? safeDateCastExpr : `(${jsonExpression})::${typeValue}`} > ?`,
                    [typeValue === 'date' ? this.#normalizeDateFilterBound(value) : this.#toNumber(value)]
                );
                break;

            case COMPARISION_OPERATORS.gte:
                knexQuery[whereMethod](
                    `${typeValue === 'date' ? safeDateCastExpr : `(${jsonExpression})::${typeValue}`} >= ?`,
                    [typeValue === 'date' ? this.#normalizeDateFilterBound(value) : this.#toNumber(value)]
                );
                break;

            case COMPARISION_OPERATORS.lt:
                knexQuery[whereMethod](
                    `${typeValue === 'date' ? safeDateCastExpr : `(${jsonExpression})::${typeValue}`} < ?`,
                    [typeValue === 'date' ? this.#normalizeDateFilterBound(value) : this.#toNumber(value)]
                );
                break;

            case COMPARISION_OPERATORS.lte:
                knexQuery[whereMethod](
                    `${typeValue === 'date' ? safeDateCastExpr : `(${jsonExpression})::${typeValue}`} <= ?`,
                    [typeValue === 'date' ? this.#normalizeDateFilterBound(value) : this.#toNumber(value)]
                );
                break;

            case COMPARISION_OPERATORS.between: {
                const [from, to] = Array.isArray(value) ? value : [];
                const safeCastExpr = typeValue === 'date' ? safeDateCastExpr : `(${jsonExpression})::${typeValue}`;

                knexQuery[whereMethod](`${safeCastExpr} BETWEEN ? AND ?`, [
                    typeValue === 'date' ? this.#normalizeDateFilterBound(from) : this.#toNumber(from),
                    typeValue === 'date' ? this.#normalizeDateFilterBound(to) : this.#toNumber(to),
                ]);
                break;
            }

            case COMPARISION_OPERATORS.notNull:
                knexQuery[whereMethod](`${jsonExpression} IS NOT NULL`);
                break;

            case COMPARISION_OPERATORS.null:
                knexQuery[whereMethod](`${jsonExpression} IS NULL`);
                break;

            case COMPARISION_OPERATORS.in: {
                const values = value.map((v) => v.toString());

                knexQuery[whereMethod](`${jsonExpression} IN (${values.map(() => '?').join(', ')})`, values);
                break;
            }

            case COMPARISION_OPERATORS.notIn: {
                const values = value.map((v) => v.toString());

                knexQuery[whereMethod](`${jsonExpression} NOT IN (${values.map(() => '?').join(', ')})`, values);
                break;
            }

            case COMPARISION_OPERATORS.like:
                knexQuery[whereMethod](`${jsonExpression} LIKE ?`, [value.toString()]);
                break;

            case COMPARISION_OPERATORS.ilike:
                knexQuery[whereMethod](`${jsonExpression} ILIKE ?`, [value.toString()]);
                break;

            case COMPARISION_OPERATORS.jsonPathEmpty:
                knexQuery[whereMethod](`(${jsonExpression} IS NULL OR ${jsonExpression} = '')`);
                break;

            case COMPARISION_OPERATORS.jsonNotPathEmpty:
                knexQuery[whereMethod](`(${jsonExpression} IS NOT NULL AND ${jsonExpression} != '')`);
                break;
        }

        return knexQuery;
    }

    #isAuxiliarySelect(selectItem) {
        if (!selectItem || typeof selectItem !== 'string') return false;

        const [left] = selectItem.split(' as ');
        const parts = left.split('.');

        if (parts.length < 2) return false;

        const tablePart = parts[0];
        const fieldPart = parts[1];

        const isAux =
            (tablePart.startsWith('aux_') ||
                tablePart.startsWith('aux-') ||
                tablePart.includes('case_auxiliar') ||
                tablePart.includes('clients_auxiliar')) &&
            !tablePart.startsWith('aux_definitions');

        const isColumnField = AuxiliaryColumnFieldHelper.isColumnField(fieldPart, tablePart);

        return isAux && !isColumnField;
    }

    #buildAuxiliaryJsonSelectSql(auxiliary, pathParts) {
        const fullPathLiteral = this.#buildJsonPathLiteral(pathParts);

        if (pathParts.length <= 1) {
            return `${auxiliary}.data #>> ${fullPathLiteral}`;
        }

        const parentPathLiteral = this.#buildJsonPathLiteral(pathParts.slice(0, -1));
        const leafKeyLiteral = `'${this.#escapeSqlLiteral(pathParts[pathParts.length - 1])}'`;

        return `CASE WHEN jsonb_typeof(${auxiliary}.data #> ${parentPathLiteral}) = 'array' THEN (SELECT STRING_AGG(elem ->> ${leafKeyLiteral}, ', ') FROM jsonb_array_elements(${auxiliary}.data #> ${parentPathLiteral}) AS elem) ELSE ${auxiliary}.data #>> ${fullPathLiteral} END`;
    }

    #buildJsonPathLiteral(pathParts) {
        const escapedPathParts = pathParts.map((part) => this.#escapeSqlLiteral(part));
        return `'{${escapedPathParts.join(',')}}'`;
    }

    #escapeSqlLiteral(value) {
        return String(value).replace(/'/g, "''");
    }

    #normalizeOrderDataType(order) {
        const raw = order?.orders?.[0]?.data_type ?? order?.data_type;
        if (raw == null || raw === '') {
            return '';
        }
        return String(raw).toUpperCase();
    }

    #pgQuoteQualifiedIdent(qualified) {
        return qualified
            .split('.')
            .map((p) => `"${String(p).replace(/"/g, '""')}"`)
            .join('.');
    }

    #buildSortSqlForJsonExpr(jsonExprSql, dataType, insensitive, direction) {
        const dt = (dataType || '').toUpperCase();
        let inner;
        if (dt === 'NUMBER' || dt === 'INTEGER' || dt === 'INT') {
            inner = `CAST((${jsonExprSql}) AS NUMERIC)`;
        } else if (dt === 'DATE' || dt === 'DATETIME' || dt === 'TIMESTAMP') {
            inner = `CASE WHEN (${jsonExprSql}) IS NULL OR (${jsonExprSql}) IN ('', 'N/A') THEN NULL ELSE CAST((${jsonExprSql}) AS TIMESTAMPTZ) END`;
        } else if (dt === 'BOOLEAN' || dt === 'BOOL') {
            inner = `CAST((${jsonExprSql}) AS BOOLEAN)`;
        } else if (dt === 'ARRAY' || dt === 'JSON' || dt === 'OBJECT') {
            inner = `COALESCE((${jsonExprSql})::text, '')`;
        } else if (dt === 'STRING') {
            inner = insensitive ? `LOWER(CAST((${jsonExprSql}) AS TEXT))` : `(${jsonExprSql})`;
        } else {
            inner = insensitive ? `LOWER(CAST((${jsonExprSql}) AS TEXT))` : `(${jsonExprSql})`;
        }
        return `${inner} ${direction} NULLS LAST`;
    }

    #orderNeedsExpressionSort(dataType, insensitive) {
        if (insensitive) {
            return true;
        }
        const dt = (dataType || '').toUpperCase();
        if (!dt) {
            return false;
        }
        return (
            dt === 'NUMBER' ||
            dt === 'INTEGER' ||
            dt === 'INT' ||
            dt === 'DATE' ||
            dt === 'DATETIME' ||
            dt === 'TIMESTAMP' ||
            dt === 'BOOLEAN' ||
            dt === 'BOOL' ||
            dt === 'ARRAY' ||
            dt === 'JSON' ||
            dt === 'OBJECT'
        );
    }

    #buildSortSqlForQuotedIdentifier(quotedIdent, dataType, insensitive, direction) {
        const dt = (dataType || '').toUpperCase();
        let inner;
        if (dt === 'NUMBER' || dt === 'INTEGER' || dt === 'INT') {
            inner = `CAST(${quotedIdent} AS NUMERIC)`;
        } else if (dt === 'DATE' || dt === 'DATETIME' || dt === 'TIMESTAMP') {
            inner = `CAST(${quotedIdent} AS TIMESTAMPTZ)`;
        } else if (dt === 'BOOLEAN' || dt === 'BOOL') {
            inner = `CAST(${quotedIdent} AS BOOLEAN)`;
        } else if (dt === 'ARRAY' || dt === 'JSON' || dt === 'OBJECT') {
            inner = `COALESCE(${quotedIdent}::text, '')`;
        } else if (dt === 'STRING') {
            inner = insensitive ? `LOWER(${quotedIdent}::text)` : `${quotedIdent}::text`;
        } else {
            inner = insensitive ? `LOWER(${quotedIdent}::text)` : `${quotedIdent}`;
        }
        return `${inner} ${direction} NULLS LAST`;
    }

    #processOrder(order, knexQuery, groupByFields, isValidToGroupBy, rawGroupByFields = []) {
        let orderField = order.field.value;
        const isQualified = orderField.includes('.');
        let fullOrderField = isQualified ? orderField : `${this.#tablename}.${orderField}`;
        const dataType = this.#normalizeOrderDataType(order);
        const direction = order.direction.value;
        const insensitive = !!order.insensitive;

        let jsonExprSql = null;

        if (
            (fullOrderField.startsWith('aux_') ||
                fullOrderField.startsWith('aux-') ||
                fullOrderField.includes('case_auxiliar') ||
                fullOrderField.includes('clients_auxiliar')) &&
            !fullOrderField.includes('aux_definitions')
        ) {
            const parts = fullOrderField.split('.');
            if (
                parts.length > 2 ||
                (parts.length === 2 &&
                    parts[1] !== 'id' &&
                    parts[1] !== 'created_by' &&
                    parts[1] !== 'updated_by' &&
                    parts[1] !== 'deleted_by' &&
                    parts[1] !== 'created_at' &&
                    parts[1] !== 'updated_at' &&
                    parts[1] !== 'deleted_at' &&
                    !AuxiliaryColumnFieldHelper.isColumnField(parts[1], parts[0]))
            ) {
                const table = parts[0];
                const pathParts = parts.slice(1);
                const path = `{${pathParts.join(',')}}`;
                const jsonPath = `'${path}'`;

                if (isValidToGroupBy) {
                    rawGroupByFields.push(knexQuery.client.raw(`${table}.data #>> ${jsonPath}`));
                }

                jsonExprSql = `${table}.data #>> ${jsonPath}`;
                fullOrderField = knexQuery.client.raw(jsonExprSql);
            }
        }

        if (isValidToGroupBy && typeof fullOrderField === 'string') {
            groupByFields.add(fullOrderField);
        }

        if (jsonExprSql) {
            const sortSql = this.#buildSortSqlForJsonExpr(jsonExprSql, dataType, insensitive, direction);
            knexQuery.orderByRaw(sortSql);
            return;
        }

        if (typeof fullOrderField === 'string') {
            if (!this.#orderNeedsExpressionSort(dataType, insensitive)) {
                knexQuery.orderBy(fullOrderField, direction);
                return;
            }
            const quoted = this.#pgQuoteQualifiedIdent(fullOrderField);
            const sortSql = this.#buildSortSqlForQuotedIdentifier(quoted, dataType, insensitive, direction);
            knexQuery.orderByRaw(sortSql);
            return;
        }

        knexQuery.orderBy(fullOrderField, direction);
    }

    #applyDateCalculatedFilter(knexQuery, filter, operation = 'substract') {
        const intervalOperator = operation === 'add' ? '+' : '-';
        const fnLabel = operation === 'add' ? 'date_calculated_add' : 'date_calculated_substract';

        switch (filter.operator.value) {
            case COMPARISION_OPERATORS.eq:
            case COMPARISION_OPERATORS.neq:
            case COMPARISION_OPERATORS.gt:
            case COMPARISION_OPERATORS.gte:
            case COMPARISION_OPERATORS.lt:
            case COMPARISION_OPERATORS.lte:
                knexQuery.whereRaw(
                    `${filter.field.value} ${filter.operator.value} NOW() ${intervalOperator} INTERVAL '${filter.value.value.value} days'`
                );
                break;

            case COMPARISION_OPERATORS.between:
                const raw = filter.value.value.value.split(',').map((v) => Number(v.trim()));

                if (raw.length !== 2 || raw.some(isNaN)) {
                    throw new Error(`${fnLabel} between requires two numeric values`);
                }

                if (operation === 'substract') {
                    const [older, newer] = raw.sort((a, b) => b - a);
                    knexQuery.whereRaw(
                        `${filter.field.value} BETWEEN NOW() - INTERVAL '${older} days' AND NOW() - INTERVAL '${newer} days'`
                    );
                } else {
                    const [smaller, larger] = raw.sort((a, b) => a - b);
                    knexQuery.whereRaw(
                        `${filter.field.value} BETWEEN NOW() + INTERVAL '${smaller} days' AND NOW() + INTERVAL '${larger} days'`
                    );
                }
                break;

            default:
                throw new Error(`Unsupported operator for ${fnLabel}: ${filter.operator.value}`);
        }

        return knexQuery;
    }

    #isAuxiliaryDateFilterString(v) {
        if (v == null) {
            return false;
        }
        const s = String(v).trim();
        if (s.length === 0) {
            return false;
        }
        return (
            this.#isIsoDateFilterString(s) ||
            this.#isCompactYmdDateFilterString(s) ||
            this.#isEpochDateFilterString(s) ||
            this.#isSlashDateFilterString(s) ||
            this.#isEnglishMonthDateFilterString(s)
        );
    }

    #normalizeDateFilterBound(v) {
        const s = v != null && v !== '' ? String(v).trim() : '';
        if (s.length === 0) {
            return s;
        }
        if (/^\d{13}$/.test(s)) {
            const d = new Date(Number(s));
            return Number.isNaN(d.getTime()) ? s : d.toISOString();
        }
        if (/^\d{10}$/.test(s)) {
            const d = new Date(Number(s) * 1000);
            return Number.isNaN(d.getTime()) ? s : d.toISOString();
        }
        if (/^\d{8}$/.test(s)) {
            const y = s.slice(0, 4);
            const m = s.slice(4, 6);
            const d = s.slice(6, 8);
            if (!this.#isValidDateParts(Number(y), Number(m), Number(d))) {
                return s;
            }
            return `${y}-${m}-${d}T00:00:00.000Z`;
        }
        const slashParts = this.#parseSlashDateParts(s);
        if (slashParts) {
            const { year, month, day } = slashParts;
            const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            return Number.isNaN(d.getTime()) ? s : d.toISOString();
        }
        if (this.#isEnglishMonthDateFilterString(s)) {
            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? s : d.toISOString();
        }
        return s;
    }

    #buildAuxiliaryJsonbTextToTimestamptzExpression(jsonExpression) {
        const reEnglishMonth =
            '(January|February|March|April|May|June|July|August|September|October|November|December)';
        const isoDateTimeNoMsRegex =
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(Z|[+-][0-9]{2}|[+-][0-9]{4}|[+-][0-9]{2}:[0-9]{2})$';
        const isoDateTimeWithMsRegex =
            '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{1,6}(Z|[+-][0-9]{2}|[+-][0-9]{4}|[+-][0-9]{2}:[0-9]{2})$';

        return `(
  SELECT (CASE
    WHEN s.j IS NULL OR s.j = '' THEN NULL
    WHEN s.j ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND substring(s.j, 6, 2)::int BETWEEN 1 AND 12
      AND substring(s.j, 9, 2)::int BETWEEN 1 AND 31
      AND substring(s.j, 9, 2)::int <= EXTRACT(DAY FROM (make_date(substring(s.j, 1, 4)::int, substring(s.j, 6, 2)::int, 1) + INTERVAL '1 month - 1 day'))
      THEN to_timestamp(s.j, 'YYYY-MM-DD')::timestamptz
    WHEN (s.j ~ '${isoDateTimeNoMsRegex}' OR s.j ~ '${isoDateTimeWithMsRegex}')
      AND substring(s.j, 6, 2)::int BETWEEN 1 AND 12
      AND substring(s.j, 9, 2)::int BETWEEN 1 AND 31
      AND substring(s.j, 9, 2)::int <= EXTRACT(DAY FROM (make_date(substring(s.j, 1, 4)::int, substring(s.j, 6, 2)::int, 1) + INTERVAL '1 month - 1 day'))
      AND substring(s.j, 12, 2)::int BETWEEN 0 AND 23
      AND substring(s.j, 15, 2)::int BETWEEN 0 AND 59
      AND substring(s.j, 18, 2)::int BETWEEN 0 AND 59
      THEN s.j::timestamptz
    WHEN s.j ~ '^[0-9]{8}$'
      AND substring(s.j, 5, 2)::int BETWEEN 1 AND 12
      AND substring(s.j, 7, 2)::int BETWEEN 1 AND 31
      AND substring(s.j, 7, 2)::int <= EXTRACT(DAY FROM (make_date(substring(s.j, 1, 4)::int, substring(s.j, 5, 2)::int, 1) + INTERVAL '1 month - 1 day'))
      THEN to_timestamp(s.j, 'YYYYMMDD')::timestamptz
    WHEN s.j ~ '^[0-9]{10}$' THEN to_timestamp((s.j)::double precision)
    WHEN s.j ~ '^[0-9]{13}$' THEN to_timestamp((s.j)::bigint / 1000.0)
    WHEN s.j ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' AND (split_part(s.j, '/', 1))::int > 12
      AND (split_part(s.j, '/', 2))::int BETWEEN 1 AND 12
      AND (split_part(s.j, '/', 1))::int BETWEEN 1 AND 31
      AND (split_part(s.j, '/', 1))::int <= EXTRACT(DAY FROM (make_date((split_part(s.j, '/', 3))::int, (split_part(s.j, '/', 2))::int, 1) + INTERVAL '1 month - 1 day'))
      THEN to_timestamp(s.j, 'DD/MM/YYYY')::timestamptz
    WHEN s.j ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' AND (split_part(s.j, '/', 2))::int > 12
      AND (split_part(s.j, '/', 1))::int BETWEEN 1 AND 12
      AND (split_part(s.j, '/', 2))::int BETWEEN 1 AND 31
      AND (split_part(s.j, '/', 2))::int <= EXTRACT(DAY FROM (make_date((split_part(s.j, '/', 3))::int, (split_part(s.j, '/', 1))::int, 1) + INTERVAL '1 month - 1 day'))
      THEN to_timestamp(s.j, 'MM/DD/YYYY')::timestamptz
    WHEN s.j ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
      AND (split_part(s.j, '/', 2))::int BETWEEN 1 AND 12
      AND (split_part(s.j, '/', 1))::int BETWEEN 1 AND 31
      AND (split_part(s.j, '/', 1))::int <= EXTRACT(DAY FROM (make_date((split_part(s.j, '/', 3))::int, (split_part(s.j, '/', 2))::int, 1) + INTERVAL '1 month - 1 day'))
      THEN to_timestamp(s.j, 'DD/MM/YYYY')::timestamptz
    WHEN s.j ~ '^([0-9]|[0-2][0-9]|3[0-1]) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4}$' THEN to_timestamp(s.j, 'DD Mon YYYY')::timestamptz
    WHEN s.j ~ '^${reEnglishMonth} ([0-9]|[0-2][0-9]|3[0-1]), [0-9]{4}$' THEN to_timestamp(s.j, 'Month DD, YYYY')::timestamptz
    WHEN s.j ~ '^([0-9]|[0-2][0-9]|3[0-1]) ${reEnglishMonth} [0-9]{4}$' THEN to_timestamp(s.j, 'DD Month YYYY')::timestamptz
    ELSE NULL
  END)
  FROM (SELECT (NULLIF(BTRIM((${jsonExpression})::text), '')) AS j) AS s
)`;
    }

    #resolveAuxiliaryFilterTypeValue(filter) {
        const raw =
            filter?.data_type ?? filter?.dataType ?? filter?.value?.data_type ?? filter?.value?.dataType ?? null;
        if (raw == null || raw === '') {
            return null;
        }
        const normalized = String(raw).toUpperCase();
        if (normalized === 'DATE' || normalized === 'DATETIME' || normalized === 'TIMESTAMP') {
            return 'date';
        }
        if (
            normalized === 'NUMBER' ||
            normalized === 'NUMERIC' ||
            normalized === 'INTEGER' ||
            normalized === 'INT' ||
            normalized === 'FLOAT' ||
            normalized === 'DOUBLE'
        ) {
            return 'numeric';
        }
        return null;
    }

    #isIsoDateFilterString(value) {
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const isoDateTimeRegex =
            /^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?$/;
        if (!isoDateRegex.test(value) && !isoDateTimeRegex.test(value)) {
            return false;
        }
        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(5, 7));
        const day = Number(value.slice(8, 10));
        return this.#isValidDateParts(year, month, day);
    }

    #isCompactYmdDateFilterString(value) {
        if (!/^\d{8}$/.test(value)) {
            return false;
        }
        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(4, 6));
        const day = Number(value.slice(6, 8));
        return this.#isValidDateParts(year, month, day);
    }

    #isEpochDateFilterString(value) {
        if (!/^\d{10}$/.test(value) && !/^\d{13}$/.test(value)) {
            return false;
        }
        const ms = value.length === 13 ? Number(value) : Number(value) * 1000;
        if (!Number.isFinite(ms)) {
            return false;
        }
        const d = new Date(ms);
        return !Number.isNaN(d.getTime());
    }

    #isSlashDateFilterString(value) {
        return this.#parseSlashDateParts(value) != null;
    }

    #isEnglishMonthDateFilterString(value) {
        const monthNameFirst = /^[A-Za-z]{3,9}\s+([0-2]?\d|3[0-1]),\s+\d{4}$/;
        const dayFirst = /^([0-2]?\d|3[0-1])\s+[A-Za-z]{3,9}\s+\d{4}$/;
        if (!monthNameFirst.test(value) && !dayFirst.test(value)) {
            return false;
        }
        const d = new Date(value);
        return !Number.isNaN(d.getTime());
    }

    #parseSlashDateParts(value) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
            return null;
        }
        const [a, b, year] = value.split('/').map((x) => Number(x));
        if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(year)) {
            return null;
        }
        let day;
        let month;
        if (a > 12 && b <= 12) {
            day = a;
            month = b;
        } else if (b > 12 && a <= 12) {
            day = b;
            month = a;
        } else {
            day = a;
            month = b;
        }
        if (!this.#isValidDateParts(year, month, day)) {
            return null;
        }
        return { year, month, day };
    }

    #isValidDateParts(year, month, day) {
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
            return false;
        }
        if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
            return false;
        }
        const d = new Date(Date.UTC(year, month - 1, day));
        return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
    }

    #toNumber(value) {
        return !isNaN(Number(value)) ? Number(value) : value;
    }
}
