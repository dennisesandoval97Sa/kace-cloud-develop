import { quoteIdentifier } from '../shared/identifier.js';

/**
 * Reads rows from the source table in keyset-paginated batches.
 */
export class SourceReader {
    #knex;

    /**
     * @param {import('knex').Knex} knex - Knex instance connected to the source database.
     */
    constructor(knex) {
        this.#knex = knex;
    }

    /**
     * Yields pages of rows ordered by primary key.
     *
     * @param {import('../domain/table-sync-plan.js').TableSyncPlan} plan - The resolved table plan.
     * @param {number} batchSize - Maximum rows per page.
     * @yields {Object[]} A page of rows.
     */
    async *readPages(plan, batchSize) {
        const primaryKey = plan.primaryKey;
        let cursor = null;

        for (;;) {
            const query = this.#knex
                .withSchema(plan.sourceSchema)
                .select(plan.columns)
                .from(plan.sourceTable)
                .orderBy(primaryKey.map((column) => ({ column, order: 'asc' })))
                .limit(batchSize);

            if (plan.where) {
                query.where((builder) => builder.whereRaw(plan.where));
            }

            if (cursor) {
                const columnList = primaryKey.map((column) => quoteIdentifier(column)).join(', ');
                const placeholders = primaryKey.map(() => '?').join(', ');
                query.whereRaw(`(${columnList}) > (${placeholders})`, cursor);
            }

            const rows = await query;

            if (rows.length === 0) {
                return;
            }

            yield rows;

            if (rows.length < batchSize) {
                return;
            }

            const lastRow = rows.at(-1);
            cursor = primaryKey.map((column) => lastRow[column]);
        }
    }
}
