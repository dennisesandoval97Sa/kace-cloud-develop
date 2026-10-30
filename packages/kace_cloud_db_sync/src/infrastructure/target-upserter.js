// El protocolo de PostgreSQL admite como máximo 65.535 parámetros bind por sentencia, y el driver
// NO rechaza el exceso: desborda el contador de 16 bits y falla con un mensaje inescrutable
// ("bind message has N parameter formats but 0 parameters"). El tope es filas × columnas, mientras
// que batchSize sólo controla filas — así que una tabla ancha lo cruza sola. Verificado.
const MAX_BIND_PARAMETERS = 65535;

/**
 * Writes batches of rows into the target table using INSERT ... ON CONFLICT.
 */
export class TargetUpserter {
    /**
     * Upserts a batch of rows and reports how many were inserted vs updated.
     *
     * Internally splits the batch into statement-sized chunks so that no single INSERT exceeds
     * PostgreSQL's bind parameter limit (rows × columns), regardless of the configured batchSize.
     *
     * @param {import('knex').Knex.Transaction} trx - Open transaction on the target database.
     * @param {import('../domain/table-sync-plan.js').TableSyncPlan} plan - The resolved table plan.
     * @param {Object[]} rows - Rows to upsert, keyed by column name.
     * @returns {Promise<{inserted: number, updated: number}>} Row counts.
     */
    async upsertBatch(trx, plan, rows) {
        if (rows.length === 0) {
            return { inserted: 0, updated: 0 };
        }

        const maxRowsPerStatement = Math.max(1, Math.floor(MAX_BIND_PARAMETERS / plan.columns.length));

        let inserted = 0;
        let updated = 0;

        for (let offset = 0; offset < rows.length; offset += maxRowsPerStatement) {
            const chunk = rows.slice(offset, offset + maxRowsPerStatement);
            const result = await this.#upsertChunk(trx, plan, chunk);
            inserted += result.inserted;
            updated += result.updated;
        }

        return { inserted, updated };
    }

    /**
     * Upserts a single statement-sized chunk of rows.
     *
     * @param {import('knex').Knex.Transaction} trx - Open transaction on the target database.
     * @param {import('../domain/table-sync-plan.js').TableSyncPlan} plan - The resolved table plan.
     * @param {Object[]} rows - Rows to upsert in a single statement, keyed by column name.
     * @returns {Promise<{inserted: number, updated: number}>} Row counts for this chunk.
     */
    async #upsertChunk(trx, plan, rows) {
        const query = trx.withSchema(plan.targetSchema).insert(rows).into(plan.targetTable).onConflict(plan.primaryKey);

        const updatableColumns = plan.updatableColumns;
        const finalQuery = updatableColumns.length > 0 ? query.merge(updatableColumns) : query.ignore();

        // xmax = 0 identifies a freshly inserted tuple; a conflicting UPDATE leaves a non-zero xmax.
        const returned = await finalQuery.returning(trx.raw('(xmax = 0) AS inserted'));

        const inserted = returned.filter((row) => row.inserted).length;

        return { inserted, updated: returned.length - inserted };
    }
}
