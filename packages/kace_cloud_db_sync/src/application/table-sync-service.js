import { SchemaIntrospector } from '../infrastructure/schema-introspector.js';
import { SourceReader } from '../infrastructure/source-reader.js';
import { TargetUpserter } from '../infrastructure/target-upserter.js';
import { TableSyncPlan } from '../domain/table-sync-plan.js';
import { SyncReport } from '../domain/sync-report.js';

/**
 * Orchestrates the table-by-table synchronization between two databases.
 */
export class TableSyncService {
    #sourceIntrospector;
    #targetIntrospector;
    #reader;
    #upserter;
    #targetKnex;

    /**
     * @param {Object} params - Dependencies.
     * @param {import('knex').Knex} params.sourceKnex - Connection to the source database.
     * @param {import('knex').Knex} params.targetKnex - Connection to the target database.
     */
    constructor({ sourceKnex, targetKnex }) {
        this.#sourceIntrospector = new SchemaIntrospector(sourceKnex);
        this.#targetIntrospector = new SchemaIntrospector(targetKnex);
        this.#reader = new SourceReader(sourceKnex);
        this.#upserter = new TargetUpserter();
        this.#targetKnex = targetKnex;
    }

    /**
     * Syncs every table in the configuration, in order.
     *
     * A failing table is recorded and the run continues with the next one.
     *
     * @param {Object} config - Validated sync configuration.
     * @returns {Promise<SyncReport>} The accumulated report.
     */
    async sync(config) {
        const report = new SyncReport();

        for (const table of config.tables) {
            try {
                const outcome = await this.#syncTable(table, config);
                report.recordSuccess({ table: table.name, ...outcome });
            } catch (error) {
                report.recordFailure({ table: table.name, error });
            }
        }

        return report;
    }

    async #syncTable(table, config) {
        const plan = await this.#buildPlan(table, config);
        let read = 0;
        let inserted = 0;
        let updated = 0;

        await this.#targetKnex.transaction(async (trx) => {
            for await (const rows of this.#reader.readPages(plan, config.batchSize)) {
                const result = await this.#upserter.upsertBatch(trx, plan, rows);
                read += rows.length;
                inserted += result.inserted;
                updated += result.updated;
            }
        });

        return { read, inserted, updated, ignoredColumns: plan.ignoredColumns };
    }

    async #buildPlan(table, config) {
        const targetTableName = table.targetName ?? table.name;

        // getColumns FIRST y en solitario: si la tabla no existe, produce el mensaje limpio
        // `Relation "x"."y" does not exist`. getPrimaryKey sobre una tabla inexistente falla en el
        // cast ::regclass con el error crudo del driver (con el SQL completo embebido). Correrlos en
        // un mismo Promise.all haría que el mensaje dependa de cuál promesa rechace primero.
        const sourceColumns = await this.#sourceIntrospector.getColumns(config.source.schema, table.name);

        const [targetColumns, primaryKey] = await Promise.all([
            this.#targetIntrospector.getColumns(config.target.schema, targetTableName),
            this.#sourceIntrospector.getPrimaryKey(config.source.schema, table.name),
        ]);

        return TableSyncPlan.build({
            table,
            sourceSchema: config.source.schema,
            targetSchema: config.target.schema,
            sourceColumns,
            targetColumns,
            primaryKey,
        });
    }
}
