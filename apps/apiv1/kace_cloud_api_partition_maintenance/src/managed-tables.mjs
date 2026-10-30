/**
 * Tables under monthly partition maintenance.
 *
 * Each entry declares the parent table name (used in `PARTITION OF`) and the
 * partition column (metadata for tests/audit; not used in DDL since the column
 * is already declared on the parent's `PARTITION BY RANGE (...)` clause).
 *
 * Adding a new table here makes the next monthly cron firing attempt to create
 * its partition automatically. The table must already be partitioned in DB
 * before being listed here.
 */
export const MANAGED_TABLES = Object.freeze([
    Object.freeze({ name: 'ws_rest_flow_executions', partitionColumn: 'created_at' }),
    Object.freeze({ name: 'event_logs', partitionColumn: 'occurred_at' }),
    Object.freeze({ name: 'history_cases', partitionColumn: 'created_at' }),
    Object.freeze({ name: 'history_usuarios', partitionColumn: 'created_at' }),
    Object.freeze({ name: 'history_aux_cases', partitionColumn: 'created_at' }),
]);
