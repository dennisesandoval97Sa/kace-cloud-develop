import { KnexRepository, QueryDBError, ValidationFailError, TenantContext, SchemaMetadataCache } from '../../../shared';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import createDayjsInstance from '../../../shared/factories/DayjsFactory.js';

export class KnexReportsViewRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, '', readerConfig);
    }

    validateViewName(vista) {
        if (!vista || typeof vista !== 'string' || !/^[a-zA-Z0-9_]+$/.test(vista)) {
            throw new ValidationFailError(`Invalid view name: ${vista}`, 'view');
        }
    }

    /**
     *
     * @param {string} vista
     * @param {import ('../index.js').ValueObjectTimeFilter } timeFilter
     * @returns
     */
    async fetchViewData(vista, timeFilter, filterDate = null) {
        this.validateViewName(vista);
        try {
            const query = this.read.table(vista).select('*');

            if (filterDate && typeof filterDate === 'string') {
                const startOfDay = `${filterDate} 00:00:00`;
                const endOfDay = `${filterDate} 23:59:59`;
                query
                    .where(timeFilter.value.field, '>=', `${startOfDay}`)
                    .andWhere(timeFilter.value.field, '<=', endOfDay);
                return await query;
            }

            query.where(timeFilter.value.field, '>', this.read.raw(timeFilter.toSQL()));
            return await query;
        } catch (error) {
            Helper.logError(`Error al consultar la vista ${vista}:`, error);
            throw new QueryDBError('custom', `Unable to read view ${vista}`);
        }
    }

    /**
     * Fetch data from a view applying a period and arbitrary conditions
     * @param {string} vista
     * @param {{ field: string, initialDate: string, endDate: string }} period
     * @param {Array} conditions
     * @returns {Promise<Array>} rows
     */
    async fetchViewDataWithConditions(vista, period = null, conditions = []) {
        this.validateViewName(vista);
        try {
            const query = this.#buildFilteredQuery(vista, period, conditions);
            return await query;
        } catch (error) {
            if (error instanceof ValidationFailError) throw error;
            Helper.logError(`Error fetching vista ${vista} with conditions: ${error?.message ?? error}`, error);
            throw new QueryDBError('custom', `Unable to read view ${vista} with filters`);
        }
    }

    /**
     * Stream rows for a view applying the same period/condition filters as
     * fetchViewDataWithConditions, without buffering the full result set into memory.
     * Returns a Node.js object-mode Readable immediately; errors that occur once
     * streaming has started surface via the stream's 'error' event / a thrown
     * exception from a `for await` loop, rather than via this method's return
     * (query-build-time errors, e.g. an unsupported operator, throw synchronously
     * before any stream is returned).
     * @param {string} vista
     * @param {{ field: string, initialDate: string, endDate: string }} period
     * @param {Array} conditions
     * @param {{ batchSize?: number }} [options]
     * @returns {import('stream').Readable}
     */
    streamViewDataWithConditions(vista, period = null, conditions = [], { batchSize = 500 } = {}) {
        this.validateViewName(vista);
        try {
            const query = this.#buildFilteredQuery(vista, period, conditions);
            return query.stream({ batchSize, highWaterMark: batchSize });
        } catch (error) {
            if (error instanceof ValidationFailError) throw error;
            Helper.logError(`Error streaming vista ${vista} with conditions: ${error?.message ?? error}`, error);
            throw new QueryDBError('custom', `Unable to stream view ${vista} with filters`);
        }
    }

    /**
     * Builds the filtered, unexecuted query shared by fetchViewDataWithConditions
     * and streamViewDataWithConditions.
     * @param {string} vista
     * @param {{ field: string, initialDate: string, endDate: string }} period
     * @param {Array} conditions
     * @returns {import('knex').Knex.QueryBuilder}
     */
    #buildFilteredQuery(vista, period, conditions) {
        const tenant = TenantContext.getTenant();
        const tenantTimezone = tenant?.timezone?.value ?? 'UTC';
        const dayjs = createDayjsInstance({ timezoneName: tenantTimezone, useTimezoneByDefault: false });

        const query = this.read.table(vista).select('*');

        const hasTimezone = (dateStr) => /Z$|[+-]\d{2}:\d{2}$/.test(dateStr);
        const hasTimeComponent = (dateStr) => /T\d{2}:\d{2}:\d{2}/.test(dateStr) && !hasTimezone(dateStr);
        const isDateLike = (v) => typeof v === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v);

        const formatForDB = (dayjsObj) => dayjsObj.utc().toISOString();

        /**
         * Normalize a date string value for use in a comparison query.
         * Accepts both dash-separated (2025-12-05) and slash-separated (2025/12/05) date strings.
         * Handles timezone-aware strings, datetime strings without TZ (treated as tenant TZ),
         * and date-only strings (treated as start or end of day in tenant TZ).
         * Non-date values are returned unchanged.
         * @param {*} value - The filter value
         * @param {'start'|'end'} anchor - For date-only strings: 'start' = 00:00:00, 'end' = 23:59:59
         * @returns {*} Normalized value ready for the DB query
         */
        const normalizeDateForOperator = (value, anchor) => {
            if (!isDateLike(value)) return value;
            const normalized = value.replace(/\//g, '-');
            if (hasTimezone(normalized)) return formatForDB(dayjs(normalized));
            if (hasTimeComponent(normalized)) return formatForDB(dayjs.tz(normalized, tenantTimezone));
            return anchor === 'end'
                ? formatForDB(dayjs.tz(normalized, tenantTimezone).endOf('day'))
                : formatForDB(dayjs.tz(normalized, tenantTimezone).startOf('day'));
        };

        const initialDate = period?.initialDate ?? period?.initial_date ?? null;
        const endDate = period?.endDate ?? period?.end_date ?? null;
        if (period && period.field && (initialDate || endDate)) {
            const from = initialDate
                ? hasTimezone(initialDate)
                    ? formatForDB(dayjs(initialDate))
                    : hasTimeComponent(initialDate)
                      ? formatForDB(dayjs.tz(initialDate, tenantTimezone))
                      : formatForDB(dayjs.tz(initialDate, tenantTimezone).startOf('day'))
                : null;

            const to = endDate
                ? hasTimezone(endDate)
                    ? formatForDB(dayjs(endDate))
                    : hasTimeComponent(endDate)
                      ? formatForDB(dayjs.tz(endDate, tenantTimezone))
                      : formatForDB(dayjs.tz(endDate, tenantTimezone).endOf('day'))
                : null;

            if (from && to) {
                query.where(period.field, '>=', from).andWhere(period.field, '<=', to);
            } else if (from) {
                query.where(period.field, '>=', from);
            } else if (to) {
                query.where(period.field, '<=', to);
            }
        }

        // Apply conditions
        // conditions is an array of { field, operator, value, type } where type is 'AND'|'OR'
        if (Array.isArray(conditions) && conditions.length) {
            const andConds = [];
            const orConds = [];

            for (const cond of conditions) {
                const type = (cond.type || 'AND').toUpperCase();
                if (type === 'OR') orConds.push(cond);
                else andConds.push(cond);
            }

            // Apply all AND conditions directly
            for (const cond of andConds) {
                const field = cond.field;
                const operator = (cond.operator || 'equals').toLowerCase();
                const value = cond.value;

                if (operator === 'notnull') {
                    query.whereNotNull(field);
                } else if (operator === 'null') {
                    query.whereNull(field);
                } else if (operator === 'equals') {
                    if (value === null) query.whereNull(field);
                    else query.where(field, value);
                } else if (operator === 'neq') {
                    if (value === null) query.whereNotNull(field);
                    else query.whereNot(field, value);
                } else if (operator === 'in') {
                    if (!Array.isArray(value) || value.length === 0) {
                        throw new ValidationFailError('Operator "in" requires a non-empty array value', 'value');
                    }
                    query.whereIn(field, value);
                } else if (operator === 'notin') {
                    if (!Array.isArray(value) || value.length === 0) {
                        throw new ValidationFailError('Operator "notIn" requires a non-empty array value', 'value');
                    }
                    query.whereNotIn(field, value);
                } else if (operator === 'gt') {
                    query.where(field, '>', normalizeDateForOperator(value, 'end'));
                } else if (operator === 'gte') {
                    query.where(field, '>=', normalizeDateForOperator(value, 'start'));
                } else if (operator === 'lt') {
                    query.where(field, '<', normalizeDateForOperator(value, 'start'));
                } else if (operator === 'lte') {
                    query.where(field, '<=', normalizeDateForOperator(value, 'end'));
                } else if (operator === 'like') {
                    query.where(field, 'like', `%${value}%`);
                } else if (operator === 'ilike') {
                    query.where(field, 'ilike', `%${value}%`);
                } else if (operator === 'between') {
                    const parseBetweenRange = (v) => {
                        const raw = Array.isArray(v)
                            ? v
                            : String(v)
                                  .split(',')
                                  .map((s) => s.trim());
                        return raw.map((s) => {
                            const n = Number(s);
                            return isNaN(n) ? s : n;
                        });
                    };
                    const range = parseBetweenRange(value);
                    if (range.length !== 2) {
                        throw new ValidationFailError(
                            'Operator "between" requires two values: an array [min, max] or a comma-separated string "min,max"',
                            'value'
                        );
                    }
                    query.whereBetween(field, [range[0], range[1]]);
                } else {
                    throw new ValidationFailError(`Unsupported operator: ${operator}`, 'operator');
                }
            }

            // Group OR conditions into a single nested clause to preserve logic
            if (orConds.length) {
                query.andWhere(function () {
                    for (let i = 0; i < orConds.length; i++) {
                        const cond = orConds[i];
                        const field = cond.field;
                        const operator = (cond.operator || 'equals').toLowerCase();
                        const value = cond.value;

                        if (operator === 'notnull') {
                            if (i === 0) this.whereNotNull(field);
                            else this.orWhereNotNull(field);
                        } else if (operator === 'null') {
                            if (i === 0) this.whereNull(field);
                            else this.orWhereNull(field);
                        } else if (operator === 'equals') {
                            if (value === null) {
                                if (i === 0) this.whereNull(field);
                                else this.orWhereNull(field);
                            } else {
                                if (i === 0) this.where(field, value);
                                else this.orWhere(field, value);
                            }
                        } else if (operator === 'neq') {
                            if (value === null) {
                                if (i === 0) this.whereNotNull(field);
                                else this.orWhereNotNull(field);
                            } else {
                                if (i === 0) this.whereNot(field, value);
                                else this.orWhereNot(field, value);
                            }
                        } else if (operator === 'in') {
                            if (!Array.isArray(value) || value.length === 0) {
                                throw new ValidationFailError(
                                    'Operator "in" requires a non-empty array value',
                                    'value'
                                );
                            }
                            if (i === 0) this.whereIn(field, value);
                            else this.orWhereIn(field, value);
                        } else if (operator === 'notin') {
                            if (!Array.isArray(value) || value.length === 0) {
                                throw new ValidationFailError(
                                    'Operator "notIn" requires a non-empty array value',
                                    'value'
                                );
                            }
                            if (i === 0) this.whereNotIn(field, value);
                            else this.orWhereNotIn(field, value);
                        } else if (operator === 'gt') {
                            const v = normalizeDateForOperator(value, 'end');
                            if (i === 0) this.where(field, '>', v);
                            else this.orWhere(field, '>', v);
                        } else if (operator === 'gte') {
                            const v = normalizeDateForOperator(value, 'start');
                            if (i === 0) this.where(field, '>=', v);
                            else this.orWhere(field, '>=', v);
                        } else if (operator === 'lt') {
                            const v = normalizeDateForOperator(value, 'start');
                            if (i === 0) this.where(field, '<', v);
                            else this.orWhere(field, '<', v);
                        } else if (operator === 'lte') {
                            const v = normalizeDateForOperator(value, 'end');
                            if (i === 0) this.where(field, '<=', v);
                            else this.orWhere(field, '<=', v);
                        } else if (operator === 'like') {
                            if (i === 0) this.where(field, 'like', `%${value}%`);
                            else this.orWhere(field, 'like', `%${value}%`);
                        } else if (operator === 'ilike') {
                            if (i === 0) this.where(field, 'ilike', `%${value}%`);
                            else this.orWhere(field, 'ilike', `%${value}%`);
                        } else if (operator === 'between') {
                            const parseBetweenRange = (v) => {
                                const raw = Array.isArray(v)
                                    ? v
                                    : String(v)
                                          .split(',')
                                          .map((s) => s.trim());
                                return raw.map((s) => {
                                    const n = Number(s);
                                    return isNaN(n) ? s : n;
                                });
                            };
                            const range = parseBetweenRange(value);
                            if (range.length !== 2) {
                                throw new ValidationFailError(
                                    'Operator "between" requires two values: an array [min, max] or a comma-separated string "min,max"',
                                    'value'
                                );
                            }
                            if (i === 0) this.whereBetween(field, [range[0], range[1]]);
                            else this.orWhereBetween(field, [range[0], range[1]]);
                        } else {
                            throw new ValidationFailError(`Unsupported operator: ${operator}`, 'operator');
                        }
                    }
                });
            }
        }

        return query;
    }

    /**
     * Return paginated distinct non-null values for a given field in a view/table.
     * Runs a COUNT query and a data query to return the total alongside the page.
     * @param {string} vista - view or table name
     * @param {string} fieldName - column name to get distinct values from
     * @param {{ limit?: number, offset?: number, search?: string }} options
     * @returns {Promise<{ values: Array<string|number>, total: number }>}
     */
    async getDistinctFieldValues(vista, fieldName, { limit = 50, offset = 0, search = '' } = {}) {
        this.validateViewName(vista);
        if (!fieldName || typeof fieldName !== 'string' || !/^[a-zA-Z0-9_]+$/.test(fieldName)) {
            throw new ValidationFailError(`Invalid field name: ${fieldName}`, 'field');
        }
        try {
            const applySearch = (q) => {
                if (!search) return q;
                return q.whereRaw('LOWER(CAST(?? AS VARCHAR)) LIKE ?', [fieldName, `%${search.toLowerCase()}%`]);
            };

            const [countResult] = await applySearch(
                this.read.table(vista).countDistinct(`${fieldName} as count`).whereNotNull(fieldName)
            );

            const total = parseInt(countResult.count, 10);

            const rows = await applySearch(
                this.read
                    .table(vista)
                    .distinct(fieldName)
                    .whereNotNull(fieldName)
                    .orderBy(fieldName)
                    .limit(limit)
                    .offset(offset)
            );

            return { values: rows.map((row) => row[fieldName]), total };
        } catch (error) {
            Helper.logError(
                `Error fetching distinct values for ${fieldName} in ${vista}: ${error?.message ?? error}`,
                error
            );
            throw new QueryDBError('custom', `Unable to read values for ${fieldName} in ${vista}`);
        }
    }

    /**
     * Return an array with the column names of the given DB view/table.
     * Tries columnInfo() with a timeout; if it times out or fails, falls back
     * to fetching a single row and extracting its keys.
     * @param {string} vista - view or table name
     * @returns {Promise<string[]>}
     */
    async getViewColumns(vista) {
        this.validateViewName(vista);

        try {
            try {
                const keys = await SchemaMetadataCache.getTableColumns(this.connection, vista);
                if (keys.length) return keys;
            } catch (e) {
                Helper.logInfo('getViewColumns: columnInfo timed out or failed, falling back', {
                    vista,
                    error: e?.message,
                });
            }

            // Fallback to fetch single row has been removed as inference is done by the caller.

            return [];
        } catch (error) {
            Helper.logError(`Error obtaining columns for vista ${vista}: ${error?.message ?? error}`, error);
            throw new QueryDBError('custom', `Unable to read columns for view ${vista}`);
        }
    }
}
