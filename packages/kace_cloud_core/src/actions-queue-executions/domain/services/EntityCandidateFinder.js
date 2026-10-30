import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export const NO_PREFILTER = Symbol('NO_PREFILTER');

export class EntityCandidateFinder {
    /**
     * @param {Object} deps
     * @param {{ connection: import('knex').Knex, tableName: string }} deps.entityRepository
     * @param {import('../../../actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js').ActionConditionsToSqlTranslator} deps.translator
     * @param {(connection: import('knex').Knex, tableName: string) => import('knex').Knex.QueryBuilder} deps.buildBaseQuery
     */
    constructor({ entityRepository, translator, buildBaseQuery }) {
        this.entityRepository = entityRepository;
        this.translator = translator;
        this.buildBaseQuery = buildBaseQuery;
    }

    /**
     * @param {object} action
     * @param {{ evaluationNow?: import('dayjs').Dayjs }} [opts]
     */
    async find(action, opts = {}) {
        try {
            const repo = this.entityRepository;
            // Multi-tenant: the live PG search_path stays at 'public', so physical table names
            // (FROM + JOIN targets) must be schema-qualified as "schema"."table". Column refs and
            // ON-clauses keep the bare relation alias. schema is null in tests => identity.
            const schema = repo.schema;
            const qualify = (table) => (schema ? `${schema}.${table}` : table);
            const baseQuery = this.buildBaseQuery(repo.connection, repo.tableName, qualify);
            const applied = this.translator.applyToQuery(baseQuery, action, {
                ...opts,
                baseTable: repo.tableName,
                qualify,
            });
            if (applied === null) return NO_PREFILTER;
            Helper.logDebug(`EntityCandidateFinder: query applied for action ${action.id?.value}`, {
                query: applied.toString(),
            });
            const rows = await applied;
            const ids = new Set();
            for (const row of rows) ids.add(row.id);
            Helper.logDebug(`EntityCandidateFinder: pre-filter count ${ids.size} for action ${action.id?.value}`);
            return ids;
        } catch (error) {
            Helper.logError(
                `EntityCandidateFinder: query failed for action ${action.id?.value}, degrading to NO_PREFILTER`,
                error
            );
            return NO_PREFILTER;
        }
    }

    /**
     * Counts candidate entities matching the action's SQL-translatable subset, WITHOUT
     * materializing rows. Reuses the same base query + translator as find(), swapping the
     * id projection for COUNT(*). Used by the off-tick backlog snapshot refresher (never by the
     * assignment tick) without paying the row/context hydration find() would.
     *
     * @param {object} action
     * @param {{ evaluationNow?: import('dayjs').Dayjs }} [opts]
     * @returns {Promise<number|typeof NO_PREFILTER>} the match count, or NO_PREFILTER when the
     *   subset can't be translated or the query fails.
     */
    async count(action, opts = {}) {
        try {
            const repo = this.entityRepository;
            const schema = repo.schema;
            const qualify = (table) => (schema ? `${schema}.${table}` : table);
            const baseQuery = this.buildBaseQuery(repo.connection, repo.tableName, qualify);
            const applied = this.translator.applyToQuery(baseQuery, action, {
                ...opts,
                baseTable: repo.tableName,
                qualify,
            });
            if (applied === null) return NO_PREFILTER;
            const [row] = await applied
                .clearSelect()
                .clearOrder()
                .countDistinct({ count: `${repo.tableName}.id` });
            return Number(row.count);
        } catch (error) {
            Helper.logError(
                `EntityCandidateFinder: count failed for action ${action.id?.value}, degrading to NO_PREFILTER`,
                error
            );
            return NO_PREFILTER;
        }
    }
}
