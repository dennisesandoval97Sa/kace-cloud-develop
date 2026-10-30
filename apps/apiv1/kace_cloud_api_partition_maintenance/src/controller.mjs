import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { computeTargetPartition, buildCreatePartitionSql } from './partition-naming.mjs';
import { MANAGED_TABLES } from './managed-tables.mjs';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.now = new Date();
    }

    async run() {
        Helper.logInfo('PartitionMaintenance: begin', { tables: MANAGED_TABLES.length });

        const results = { created: [], skipped: [], failed: [] };

        for (const { name } of MANAGED_TABLES) {
            try {
                const target = computeTargetPartition(this.now, name);
                const sql = buildCreatePartitionSql(target, name);

                // Pre-check: did the partition already exist? CREATE TABLE IF NOT EXISTS
                // doesn't tell us, and Knex auto-commits each .raw() so a post-check
                // against pg_class.xmin would see this connection's later transaction
                // and always report `existed = true`.
                const beforeResult = await this.database_connection.raw(
                    `SELECT COUNT(*)::int AS count FROM pg_class WHERE relname = ?`,
                    [target.name]
                );
                const alreadyExisted = beforeResult.rows[0].count > 0;

                Helper.logInfo('PartitionMaintenance: executing DDL', {
                    table: name,
                    partition: target.name,
                });
                await this.database_connection.raw(sql);

                (alreadyExisted ? results.skipped : results.created).push(target.name);

                Helper.logInfo('PartitionMaintenance: partition ready', {
                    table: name,
                    partition: target.name,
                    alreadyExisted,
                });
            } catch (error) {
                Helper.logError(`PartitionMaintenance: ${name} failed`, error);
                results.failed.push({ table: name, error: error.message });
                // Continue with the next table — one failure must not abort the rest.
                // NOTE: this also absorbs infrastructure errors (lost connection, pool exhaustion).
                // If those occur, every subsequent table will also fail; the total-failure
                // gate at the end will return 500.
            }
        }

        Helper.logInfo('PartitionMaintenance: end', results);

        try {
            await this.database_connection.destroy();
        } catch (e) {
            Helper.logError('PartitionMaintenance: error destroying connection', e);
        }

        if (results.failed.length === MANAGED_TABLES.length) {
            return HttpResponse.internalServerError({ errors: results.failed, event: this.event });
        }
        return HttpResponse.ok({ results, event: this.event });
    }
}
