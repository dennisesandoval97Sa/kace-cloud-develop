# kace_cloud_api_partition_maintenance

Monthly EventBridge-scheduled Lambda that creates the next month's partition for every partitioned table in `MANAGED_TABLES`, against every tenant.

Pattern: multi-tenant orchestrator (`OrchestratorHelper.createOrchestrator`) + per-tenant Lambda wrapped in `withTenantContext`.

Schedule: cron `0 3 1 * ? *` (day 1 of each month at 03:00 UTC). The Lambda creates the partition two months ahead, so a single missed run does not break ingestion.

Currently managed (see `src/managed-tables.mjs`):

| Table | Partition column |
|---|---|
| `ws_rest_flow_executions` | `created_at` |
| `event_logs` | `occurred_at` |
| `history_cases` | `created_at` |
| `history_usuarios` | `created_at` |
| `history_aux_cases` | `created_at` |

---

## Adding a new partitioned table

This guide is the canonical sequence for converting an existing (non-partitioned) table into a monthly RANGE-partitioned one and enrolling it in the monthly cron. Optimized for the case where the source table is already large (>10 GB).

The pattern was validated end-to-end against a local Postgres 16 with Tasks 11/T4-T7 of `docs/superpowers/plans/2026-05-12-event-logs-and-history-tables-partitioning.md`. Several non-obvious bugs were surfaced during that exercise — they are now captured in the orchestrator and in the "Pitfalls" section below.

### Phase 0 — Pre-deploy validation (per tenant)

Run `scripts/partition-inspection.sql` against every tenant DB **before merging** the migration. The script reports five things:

1. Table size (`total_size`, `data_size`, `index_size`).
2. NULL count in the partition column (the migration aborts if non-zero).
3. Oldest row (defines how many historical partitions get created).
4. FK orphans (only if the table has FKs to re-create after the swap).
5. Tablespace usage (compare with `df -h` / CloudWatch `FreeStorageSpace`).

Hard blockers:
- `nulls > 0` for the partition column → clean up first with a backfill script. The migration's step-0 guard would otherwise abort.
- `FreeStorageSpace < 2.5 × max(table_size)` → the bulk `INSERT INTO ... SELECT *` temporarily doubles the table's footprint. Free up space first.
- `orphans > 0` for any FK column → either clean orphans or declare the re-created FK as `NOT VALID`.

If the new table has different precondition checks (e.g., an extra FK column), extend `scripts/partition-inspection.sql` first.

### Phase 1 — Write the migration

The orchestrator `partitionTable` (in `packages/kace_cloud_database/utils/partition-helpers.js`) encapsulates all 12 steps of the rename-swap-with-copy + delta sync. Each migration is a thin wrapper:

```javascript
// packages/kace_cloud_database/migrations/<TIMESTAMP>_partition_<TABLE>.js
import { partitionTable, restoreToNonPartitioned } from '../utils/partition-helpers.js';

export async function up(knex) {
    await partitionTable(knex, {
        sourceTable: '<TABLE>',
        partitionColumn: '<created_at or occurred_at>',
        secondaryIndexes: [
            // Preserve every existing non-PK index on the source AND any new ones.
            // Index names are schema-scoped: pick names that don't collide across tables.
            { name: '<TABLE>_<col>_idx', columns: ['<col1>', '<col2>'] },
        ],
        foreignKeys: [
            // One entry per FK on the source. The orchestrator drops the legacy table
            // and the FKs go with it; this list re-creates them on the partitioned parent.
            {
                column: '<fk_col>',
                refTable: '<ref_table>',
                refColumn: '<ref_col>',
                constraintName: '<TABLE>_<fk_col>_foreign',
            },
        ],
    });
}

export async function down(knex) {
    await restoreToNonPartitioned(knex, {
        sourceTable: '<TABLE>',
        schemaBuilder: (table) => {
            // Re-declare the ORIGINAL non-partitioned schema as it exists in production today.
            // Cross-reference all prior ALTER migrations (column type changes, added columns, etc.).
            // For history tables: createHistoryTable in 20241203142315 + the `delete_defaultTo` migration.
            // For audit tables (event_logs): plus add-column migrations and the secondary index.
            table.string('id', 36).primary();
            // ...
            table.index([...], '<index_name>');
            table.foreign('<fk_col>').references('<ref_table>.<ref_col>');
        },
    });
}
```

Generate the timestamp with `date -u +%Y%m%d%H%M%S`. If you are adding multiple migrations in the same PR, increment by one second so they run in the desired order (smallest table first).

The down() is intentionally costly (full data copy back). Treat it as an emergency rollback path — see the WARNING in `restoreToNonPartitioned`'s JSDoc.

### Phase 2 — Enroll in the cron

Add an entry to `MANAGED_TABLES` in `src/managed-tables.mjs`:

```javascript
export const MANAGED_TABLES = Object.freeze([
    // ...
    Object.freeze({ name: '<TABLE>', partitionColumn: '<created_at or occurred_at>' }),
]);
```

The `partitionColumn` field is metadata for tests; the cron's DDL only needs the table name. The corresponding tests in `tests/managed-tables.unit.test.mjs` assert:

- Every name passes `/^[a-z][a-z0-9_]*$/` (defense-in-depth against SQL injection).
- `partitionColumn` is either `'created_at'` or `'occurred_at'`.
- No duplicate names.
- The constant is frozen.

If the new table uses a different partition column name, update the test's expectation.

### Phase 3 — Deploy

Plan a maintenance window with these constraints:

- **Day:** any day except 1st (avoids racing the cron at 03:00 UTC). Day 15 ± 5 is ideal.
- **Hour:** 02:00 – 05:00 COT (lowest traffic in Colombia).
- **Estimated duration per tenant:** ~6–8 min per table at 10 GB (5 min bulk INSERT online + 1–3 min delta sync under `ACCESS EXCLUSIVE` lock). Multiply by N tables, then by `max(per_tenant_time)` since `pnpm deploy` runs tenants in parallel (concurrency=15).

The migration uses `SET LOCAL lock_timeout = '10s'` to fail fast on lock contention. If a tenant aborts, re-run for that tenant once contention clears.

### Phase 4 — Post-deploy validation (per tenant)

Run these five checks for every tenant:

```sql
-- 1) Table is now partitioned (relkind = 'p')
SELECT relname, relkind FROM pg_class
WHERE relname = '<TABLE>';

-- 2) Row count unchanged (compare with pre-migration figure from Phase 0)
SELECT COUNT(*) FROM <TABLE>;

-- 3) Expected number of partitions (oldest historical month → cutoff + 12, plus DEFAULT)
SELECT relname FROM pg_inherits
JOIN pg_class ON pg_inherits.inhrelid = pg_class.oid
WHERE inhparent = '<TABLE>'::regclass
ORDER BY relname;

-- 4) Legacy <TABLE>_pre_partition no longer exists
SELECT relname FROM pg_class WHERE relname = '<TABLE>_pre_partition';
-- expected: 0 rows

-- 5) FKs survived the swap (only if the table has FKs)
SELECT conname FROM pg_constraint
WHERE conrelid = '<TABLE>'::regclass AND contype = 'f';
```

### Phase 5 — Verify the cron picks up the new table

The next firing of the EventBridge rule (day 1 of next month, 03:00 UTC) will iterate the updated `MANAGED_TABLES` and idempotently `CREATE TABLE IF NOT EXISTS` the month-N+2 partition for the new table. CloudWatch logs from the Lambda show the per-table breakdown:

```
PartitionMaintenance: end { created: [...], skipped: [...], failed: [...] }
```

If `failed` includes the new table, the most common cause is that the partitioned parent doesn't exist yet (the migration didn't reach that tenant). Re-run the migration for the failing tenant; the cron will succeed next month.

---

## Pitfalls (lessons from prior partitioning work)

These trapped the previous implementation and are now documented inline in the orchestrator. If you bypass the orchestrator, you'll need to handle them yourself.

| Pitfall | Symptom | Where handled |
|---|---|---|
| `CREATE TABLE PARTITION OF ... FOR VALUES FROM (?)` with a Knex `?` placeholder | PostgreSQL rejects the DDL: "syntax error at or near '$1'" | `partitionTable` interpolates dates as ISO literals (safe — formatPartitionDate-only). |
| Index name collision between source and new partitioned table | `relation "<idx_name>" already exists` at step 6 | `partitionTable` issues `DROP INDEX IF EXISTS` before each `CREATE INDEX`. The original index dies with the renamed legacy in step 11. |
| `SET lock_timeout = '10s'` outside a transaction | The setting silently goes session-scope; the next call on the same pool connection still uses it | Use `SET LOCAL`, and ensure the calling migration does **NOT** export `config = { transaction: false }`. JSDoc on `partitionTable` and `restoreToNonPartitioned` warns about this. |
| Detecting "did `CREATE TABLE IF NOT EXISTS` actually create?" via `xmin < txid_current()` | Always reports `existed = true` because Knex auto-commits each `.raw()` (DDL and inspection are in separate TXs) | The controller does a pre-DDL `SELECT COUNT(*) FROM pg_class` instead. |
| Stale table names in the spec/plan | FK migration fails with "relation \"casos\" does not exist" — the table was renamed to `cases` in migration `20250626151010` | Cross-check FK target names against the current migration history, not the original `createTable` migration. |
| `addMonths` with day overflow | `addMonths(Jan 31, 1)` returning Mar 3 (PG `Date.UTC` overflow normalization) | The helper always normalizes the result to day=1. JSDoc spells this out. |

---

## Follow-up: drop legacy `restflow_execution_logs` table

This PR retired the **code paths** that wrote to `asistencia.restflow_execution_logs`. The table itself (52 GB) stays in place during a verification window of 2-7 days. After verification, create a follow-up PR with this migration:

`packages/kace_cloud_database/migrations/<TIMESTAMP>_drop_restflow_execution_logs_table.js`:

```javascript
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.raw("SET lock_timeout = '5s'");
    await knex.schema.dropTableIfExists('restflow_execution_logs');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema.createTable('restflow_execution_logs', function (table) {
        table.string('id', 36).primary();
        table.string('restflow_id', 36).notNullable();
        table.string('case_id', 36).nullable();
        table.string('client_id', 36).nullable();
        table.jsonb('context').nullable();
        table.timestamp('executed_at').defaultTo(knex.fn.now());
        table.string('executed_by', 36).nullable();
    });
}
```

Apply during a low-traffic window. `DROP TABLE` removes `relfilenode` files directly — no VACUUM needed.
