/**
 * Convert ws_rest_flow_executions into a partitioned table by RANGE on created_at (monthly).
 *
 * Strategy: rename-swap. Create the partitioned shape, backfill from the existing table,
 * swap names atomically, drop the legacy non-partitioned table. Volume confirmed low at design time.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }

    // 1. Create the partitioned parent (PK includes created_at as required by Postgres).
    await knex.raw(`
        CREATE TABLE ws_rest_flow_executions_partitioned (
            id              varchar(36) NOT NULL,
            flow_id         varchar(36),
            external_code   varchar(255),
            initial_context jsonb,
            status          varchar(20) NOT NULL DEFAULT 'pending',
            result          jsonb,
            error           jsonb,
            created_by      varchar(36),
            created_at      timestamp NOT NULL,
            started_at      timestamp,
            completed_at    timestamp,
            updated_by      varchar(36),
            updated_at      timestamp,
            deleted_by      varchar(36),
            deleted_at      timestamp,
            PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
    `);

    // 2. Pre-create 13 partitions: current month + 12 future months.
    const now = new Date();
    const baseYear = now.getUTCFullYear();
    const baseMonth = now.getUTCMonth(); // 0-indexed

    for (let i = 0; i < 13; i++) {
        const fromMonthIndex = baseMonth + i;
        const fromYear = baseYear + Math.floor(fromMonthIndex / 12);
        const fromMonth = (fromMonthIndex % 12) + 1; // back to 1-indexed
        const toMonthIndex = fromMonthIndex + 1;
        const toYear = baseYear + Math.floor(toMonthIndex / 12);
        const toMonth = (toMonthIndex % 12) + 1;

        const partitionName = `ws_rest_flow_executions_${fromYear}_${String(fromMonth).padStart(2, '0')}`;
        const fromDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`;
        const toDate = `${toYear}-${String(toMonth).padStart(2, '0')}-01`;

        await knex.raw(`
            CREATE TABLE ${partitionName}
                PARTITION OF ws_rest_flow_executions_partitioned
                FOR VALUES FROM ('${fromDate}') TO ('${toDate}')
        `);
    }

    // 3. Safety-net default partition.
    await knex.raw(`
        CREATE TABLE ws_rest_flow_executions_default
            PARTITION OF ws_rest_flow_executions_partitioned DEFAULT
    `);

    // 4. Backfill existing data into the partitioned table.
    await knex.raw(`
        INSERT INTO ws_rest_flow_executions_partitioned
        SELECT * FROM ws_rest_flow_executions
    `);

    // 5. Secondary indexes (propagate to existing + future partitions).
    await knex.raw(`
        CREATE INDEX ws_rest_flow_executions_flow_id_created_at_idx
            ON ws_rest_flow_executions_partitioned (flow_id, created_at)
    `);
    await knex.raw(`
        CREATE INDEX ws_rest_flow_executions_pending_progress_idx
            ON ws_rest_flow_executions_partitioned (status)
            WHERE status IN ('pending', 'in_progress')
    `);
    await knex.raw(`
        CREATE INDEX ws_rest_flow_executions_external_code_idx
            ON ws_rest_flow_executions_partitioned (external_code)
    `);

    // 6. Atomic rename-swap + DROP of legacy.
    await knex.raw("SET lock_timeout = '5s'");
    await knex.raw('ALTER TABLE ws_rest_flow_executions RENAME TO ws_rest_flow_executions_pre_partition');
    await knex.raw('ALTER TABLE ws_rest_flow_executions_partitioned RENAME TO ws_rest_flow_executions');
    await knex.raw('DROP TABLE ws_rest_flow_executions_pre_partition');
}

/**
 * Emergency rollback. Recreates the non-partitioned table, copies data back, drops the partitioned one.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    if (knex.client.config.client !== 'pg') {
        return;
    }

    await knex.raw(`
        CREATE TABLE ws_rest_flow_executions_pre_partition (
            id              varchar(36) PRIMARY KEY,
            flow_id         varchar(36),
            external_code   varchar(255),
            initial_context jsonb,
            status          varchar(20) NOT NULL DEFAULT 'pending',
            result          jsonb,
            error           jsonb,
            created_by      varchar(36),
            created_at      timestamp,
            started_at      timestamp,
            completed_at    timestamp,
            updated_by      varchar(36),
            updated_at      timestamp,
            deleted_by      varchar(36),
            deleted_at      timestamp
        )
    `);

    await knex.raw(`
        INSERT INTO ws_rest_flow_executions_pre_partition
        SELECT * FROM ws_rest_flow_executions
    `);

    await knex.raw('ALTER TABLE ws_rest_flow_executions RENAME TO ws_rest_flow_executions_partitioned');
    await knex.raw('ALTER TABLE ws_rest_flow_executions_pre_partition RENAME TO ws_rest_flow_executions');
    await knex.raw('DROP TABLE ws_rest_flow_executions_partitioned CASCADE');
}
