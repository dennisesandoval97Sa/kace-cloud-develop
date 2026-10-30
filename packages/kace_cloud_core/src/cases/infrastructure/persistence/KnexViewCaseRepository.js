import { Helper, KnexRepository, QueryDBError } from '../../../shared/index.js';
import { CASES_DEFAULT_VIEW } from '../../constants.js';
import { ViewCase } from '../../domain/ViewCase.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';

const MATVIEW_DEFAULT_PREFIX = 'mv_dashboard';
const SAFE_MATVIEW_PREFIX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class KnexViewCaseRepository extends KnexRepository {
    #matviewPrefix;
    // Resolved lazily on first MV query and cached for the lifetime of this instance.
    // null = not yet resolved.
    #resolvedPrefix = null;

    constructor(config, viewName = CASES_DEFAULT_VIEW, readerConfig = null, matviewPrefix = MATVIEW_DEFAULT_PREFIX) {
        if (!SAFE_MATVIEW_PREFIX.test(matviewPrefix)) {
            throw new InvalidArgumentError(`Invalid matview prefix: ${matviewPrefix}`);
        }
        super(config, viewName, readerConfig);
        this.#matviewPrefix = matviewPrefix;
    }

    get matviewPrefix() {
        return this.#resolvedPrefix ?? this.#matviewPrefix;
    }

    // Lee los conteos ANS pre-agregados del materialized view (refrescado ~1/min por el
    // lambda dashboard-counts-refresh), por lo que pueden tener hasta ~60s de staleness.
    // Reemplaza el count() en vivo por request sobre `cases` que saturaba la CPU del writer.
    async getAnsCountsFromView() {
        const prefix = await this.#effectivePrefix();
        try {
            const row = await this.reader(this.qualifiedName(`${prefix}_ans_counts`))
                .select('pending', 'to_overcome', 'defeated', 'managed')
                .first();

            return {
                pending: Number(row?.pending ?? 0),
                toOvercome: Number(row?.to_overcome ?? 0),
                defeated: Number(row?.defeated ?? 0),
                managed: Number(row?.managed ?? 0),
            };
        } catch (error) {
            Helper.logError('Error reading ans counts from materialized view', error);
            throw new QueryDBError('count');
        }
    }

    async getStateCountsFromView() {
        const prefix = await this.#effectivePrefix();
        try {
            const rows = await this.reader(this.qualifiedName(`${prefix}_state_counts`)).select(
                'estado_id',
                'estado_nombre',
                'icon_class',
                'total'
            );

            return rows.map((row) => ({
                id: row.estado_id,
                nombre: row.estado_nombre,
                icon_class: row.icon_class,
                count: String(row.total),
            }));
        } catch (error) {
            Helper.logError('Error reading state counts from materialized view', error);
            throw new QueryDBError('count');
        }
    }

    async getGroupCountsFromView() {
        const prefix = await this.#effectivePrefix();
        return this.#getEntityCountsFromMatview(`${prefix}_group_counts`, 'grupo_id', 'grupo_nombre');
    }

    async getResponsibleCountsFromView() {
        const prefix = await this.#effectivePrefix();
        return this.#getEntityCountsFromMatview(`${prefix}_responsible_counts`, 'responsable_id', 'responsable_nombre');
    }

    /**
     * Resolves the matview prefix on first call and caches the result for this instance.
     * When the candidate prefix is the default, no DB query is issued. Otherwise, performs
     * a lightweight existence check and falls back to mv_dashboard if the MVs are missing.
     *
     * Uses raw SQL rather than the query builder. The original reason was the SQLite
     * `query-response` listener in KnexRepository, which threw for any table missing from
     * #fieldsToParse; that listener was removed along with the rest of the dead SQLite
     * support, so the constraint no longer applies and the raw SQL is simply kept as is.
     */
    async #effectivePrefix() {
        if (this.#resolvedPrefix !== null) return this.#resolvedPrefix;
        if (this.#matviewPrefix === MATVIEW_DEFAULT_PREFIX) {
            return (this.#resolvedPrefix = MATVIEW_DEFAULT_PREFIX);
        }
        const tableName = `${this.#matviewPrefix}_ans_counts`;
        const s = this.schema;
        const target = s ? `"${s}"."${tableName}"` : `"${tableName}"`;
        try {
            await this.connection.raw(`SELECT 1 FROM ${target} LIMIT 1`);
            return (this.#resolvedPrefix = this.#matviewPrefix);
        } catch (error) {
            const isMissing =
                error?.code === '42P01' ||
                error?.message?.includes('no such table') ||
                error?.message?.includes('no such view');
            if (isMissing) {
                Helper.logInfo(
                    `KnexViewCaseRepository: MVs for prefix "${this.#matviewPrefix}" not found, falling back to ${MATVIEW_DEFAULT_PREFIX}`
                );
                return (this.#resolvedPrefix = MATVIEW_DEFAULT_PREFIX);
            }
            return (this.#resolvedPrefix = this.#matviewPrefix);
        }
    }

    async #getEntityCountsFromMatview(matview, idColumn, nameColumn) {
        try {
            const rows = await this.reader(this.qualifiedName(matview)).select(
                `${idColumn} as entity_id`,
                `${nameColumn} as entity_name`,
                'estado_id',
                'estado_nombre',
                'total'
            );

            const entities = {};
            rows.forEach((row) => {
                const { entity_id, entity_name, estado_id, estado_nombre, total } = row;
                if (!entities[entity_id]) {
                    entities[entity_id] = {
                        id: entity_id,
                        nombre: entity_name,
                        estados: [],
                    };
                }
                entities[entity_id].estados.push({
                    id: estado_id,
                    estado: estado_nombre || 'Desconocido',
                    count: parseInt(total, 10),
                });
            });

            return entities;
        } catch (error) {
            Helper.logError('Error reading entity counts from materialized view', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Searches for `Action` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Action[]>} A promise that resolves to an array of `Action` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);
            const rows = await queryBuilder;
            return rows.map((row) => new ViewCase(row));
        } catch (error) {
            Helper.logError('Error searching actions:', error);
            throw new QueryDBError('search', 'Failed to search actions');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.table().count());

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`count`);
        }
    }

    /**
     * Counts cases grouped by status applying the given criteria.
     *
     * NOTA MSKT-1392: `estado_actual` viene de la vista (`view_cases_details_v9.js`/
     * `view_casosV6.js`), que ahora resuelve casos sin `siguiente_estado_id` contra el
     * `cases.estado_id` persistido en vez de NULL. Los conteos por estado que agrupan aquí
     * pueden cambiar para esos casos tras el deploy — ver el comentario de esas vistas.
     * @param {Criteria} criteria - The criteria to filter cases.
     * @returns {Promise<Array<{status: string, count: number, color: string|null}>>} - Array of objects with status name, count and color.
     */
    async searchCountByStatus(criteria) {
        try {
            const queryBuilder = this.table()
                .select(`${this.tableName}.estado_actual as status`, 'estados.color as color')
                .count(`${this.tableName}.id as count`)
                .leftJoin(this.qualifiedName('estados'), 'estados.nombre', `${this.tableName}.estado_actual`);

            criteria.convertToKnex(queryBuilder);

            queryBuilder.groupBy(`${this.tableName}.estado_actual`, 'estados.color');

            const rows = await queryBuilder;
            return rows.map((row) => ({
                status: row.status,
                count: parseInt(row.count, 10),
                color: row.color ?? null,
            }));
        } catch (error) {
            Helper.logError('Error counting cases by status', error);
            throw new QueryDBError('count');
        }
    }
}
