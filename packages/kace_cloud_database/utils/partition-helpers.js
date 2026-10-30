/**
 * Pure helpers for monthly RANGE partitioning. UTC-only.
 */

/**
 * @param {Date} date
 * @returns {Date} first day of the same month at 00:00:00 UTC
 */
export function firstDayOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * @param {Date} date
 * @returns {Date} first day of the next month at 00:00:00 UTC
 */
export function firstDayOfNextMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/**
 * Return the first day of the month that is `n` calendar months from `date`.
 * The day-of-month component of the input is ignored — the result is always
 * the first day of the target month at 00:00:00 UTC.
 *
 * @param {Date} date
 * @param {number} n  calendar months to add (may be negative)
 * @returns {Date}
 */
export function addMonths(date, n) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

/**
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD' (UTC)
 */
export function formatPartitionDate(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * @param {string} tableName  PARTITION OF tableName
 * @param {Date} date
 * @returns {string} '<tableName>_YYYY_MM'
 */
export function partitionNameForMonth(tableName, date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${tableName}_${y}_${m}`;
}

/**
 * Enumerate monthly partitions in the half-open interval [from, to).
 *
 * @param {string} tableName
 * @param {Date} fromDate  first day of month (inclusive)
 * @param {Date} toDate    first day of month (exclusive)
 * @returns {Array<{ name: string, fromDate: string, toDate: string }>}
 */
export function generateMonthlyPartitions(tableName, fromDate, toDate) {
    const result = [];
    let m = firstDayOfMonth(fromDate);
    const end = firstDayOfMonth(toDate);
    while (m < end) {
        const next = firstDayOfNextMonth(m);
        result.push({
            name: partitionNameForMonth(tableName, m),
            fromDate: formatPartitionDate(m),
            toDate: formatPartitionDate(next),
        });
        m = next;
    }
    return result;
}

/**
 * Query all views and materialized views that depend (directly or transitively) on
 * `tableName` in the current schema. Returns rows ordered deepest-dependent-first so
 * they can be dropped in that order and recreated in reverse.
 *
 * Limitation: view permissions (GRANTs), materialized-view indexes, and ownership are
 * NOT preserved across the drop+recreate cycle. Only the SELECT definition is restored.
 * This is acceptable for this project because views are owned by the migration user and
 * no per-user GRANT privileges exist on them.
 *
 * @param {import('knex').Knex} knex
 * @param {string} tableName  unqualified table name (current schema is assumed)
 * @returns {Promise<Array<{ qualified_name: string, kind: string, definition: string }>>}
 */
async function getDependentViews(knex, tableName) {
    const result = await knex.raw(
        `
        WITH RECURSIVE deps AS (
            SELECT DISTINCT c.oid, n.nspname AS schema, c.relname AS name, c.relkind AS kind, 1 AS depth
            FROM pg_class t
            JOIN pg_depend d ON d.refobjid = t.oid AND d.deptype = 'n'
            JOIN pg_rewrite r ON r.oid = d.objid
            JOIN pg_class c ON c.oid = r.ev_class AND c.relkind IN ('v', 'm')
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE t.relname = ?
              AND t.relnamespace = current_schema()::regnamespace
              AND t.oid != c.oid

            UNION

            SELECT DISTINCT c.oid, n.nspname, c.relname, c.relkind, deps.depth + 1
            FROM deps
            JOIN pg_depend d ON d.refobjid = deps.oid AND d.deptype = 'n'
            JOIN pg_rewrite r ON r.oid = d.objid
            JOIN pg_class c ON c.oid = r.ev_class AND c.relkind IN ('v', 'm')
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE deps.oid != c.oid
        )
        SELECT
            quote_ident(schema) || '.' || quote_ident(name) AS qualified_name,
            kind,
            pg_get_viewdef(oid, true) AS definition,
            MAX(depth) AS max_depth
        FROM deps
        GROUP BY oid, schema, name, kind
        ORDER BY MAX(depth) DESC, name
        `,
        [tableName]
    );
    return result.rows;
}

/**
 * Run the full rename-swap-with-copy partitioning migration for a single table.
 *
 * Steps 0-13 from spec 2026-05-12-event-logs-and-history-tables-partitioning-design.md.
 *
 * Views (regular and materialized) that depend on `sourceTable` are captured before
 * the rename swap and recreated after. After recreation the views reference the new
 * partitioned table (which now owns `sourceTable`'s name).
 *
 * Limitation: view permissions (GRANTs), materialized-view indexes, and ownership are
 * NOT preserved across the drop+recreate cycle. Only the SELECT definition is restored.
 *
 * IMPORTANT: This function uses `SET LOCAL` to scope the lock timeout to the current
 * transaction. The calling migration MUST NOT export `config = { transaction: false }`
 * — doing so silently downgrades the lock-timeout safety net to session-level scope.
 *
 * @param {import('knex').Knex} knex
 * @param {{
 *   sourceTable: string,
 *   partitionColumn: string,
 *   secondaryIndexes?: Array<{ name: string, columns: string[] }>,
 *   foreignKeys?: Array<{ column: string, refTable: string, refColumn: string, constraintName: string }>,
 *   futureMonths?: number,
 * }} opts
 */
export async function partitionTable(knex, opts) {
    if (knex.client.config.client !== 'pg') {
        return;
    }

    const { sourceTable, partitionColumn, secondaryIndexes = [], foreignKeys = [], futureMonths = 12 } = opts;
    const partitioned = `${sourceTable}_partitioned`;
    const legacy = `${sourceTable}_pre_partition`;

    // 0) NULL guard
    const nullCheck = await knex.raw(`SELECT COUNT(*)::int AS count FROM ?? WHERE ?? IS NULL`, [
        sourceTable,
        partitionColumn,
    ]);
    const nullCount = nullCheck.rows[0].count;
    if (nullCount > 0) {
        throw new Error(`Cannot partition ${sourceTable}: ${nullCount} rows have NULL ${partitionColumn}`);
    }

    // 1) Compute month range. If the source is empty, start from cutoff (no historical partitions).
    const minResult = await knex.raw(`SELECT MIN(??) AS min_ts FROM ??`, [partitionColumn, sourceTable]);
    const minTs = minResult.rows[0].min_ts;
    const cutoff = firstDayOfNextMonth(new Date());
    const oldest = minTs ? firstDayOfMonth(new Date(minTs)) : cutoff;
    const newest = addMonths(cutoff, futureMonths);

    // 2) Sibling partitioned table with identical schema
    await knex.raw(`CREATE TABLE ?? (LIKE ?? INCLUDING DEFAULTS INCLUDING CONSTRAINTS) PARTITION BY RANGE (??)`, [
        partitioned,
        sourceTable,
        partitionColumn,
    ]);

    // 3) Replace PK with (id, partition_col)
    await knex.raw(`ALTER TABLE ?? DROP CONSTRAINT IF EXISTS ${sourceTable}_pkey`, [partitioned]);
    await knex.raw(`ALTER TABLE ?? ADD PRIMARY KEY (id, ??)`, [partitioned, partitionColumn]);

    // 4) Monthly partitions from oldest to newest
    // NOTE: PostgreSQL DDL does not support parameterized placeholders for partition
    // bounds in PARTITION OF ... FOR VALUES FROM (...) TO (...). The date strings
    // produced by formatPartitionDate are safe ISO-8601 literals (YYYY-MM-DD only,
    // no user input), so direct string interpolation is correct here.
    const partitions = generateMonthlyPartitions(sourceTable, oldest, newest);
    for (const p of partitions) {
        await knex.raw(`CREATE TABLE ?? PARTITION OF ?? FOR VALUES FROM ('${p.fromDate}') TO ('${p.toDate}')`, [
            p.name,
            partitioned,
        ]);
    }

    // 5) DEFAULT partition
    await knex.raw(`CREATE TABLE ?? PARTITION OF ?? DEFAULT`, [`${sourceTable}_default`, partitioned]);

    // 6) Secondary indexes on parent (propagate to existing + future partitions).
    // Index names are schema-scoped in PostgreSQL. Drop matching indexes from sourceTable
    // first so the same name can be recreated on the new partitioned table.
    // sourceTable is dropped in step 11, so this is safe.
    for (const idx of secondaryIndexes) {
        await knex.raw(`DROP INDEX IF EXISTS ??`, [idx.name]);
        const colsList = idx.columns.map(() => '??').join(', ');
        await knex.raw(`CREATE INDEX ?? ON ?? (${colsList})`, [idx.name, partitioned, ...idx.columns]);
    }

    // 7) Snapshot timestamp + bulk INSERT (online — source still receives writes)
    const snapshotResult = await knex.raw(`SELECT clock_timestamp() AS snapshot_ts`);
    const snapshotTs = snapshotResult.rows[0].snapshot_ts;
    await knex.raw(`INSERT INTO ?? SELECT * FROM ??`, [partitioned, sourceTable]);

    // 8) Critical window — acquire ACCESS EXCLUSIVE
    // SET LOCAL: resets at end of TX. Timeout applies to lock acquisition only, not to lock duration.
    await knex.raw(`SET LOCAL lock_timeout = '10s'`);
    await knex.raw(`LOCK TABLE ?? IN ACCESS EXCLUSIVE MODE`, [sourceTable]);

    // 9) Delta sync — only rows newer than snapshot (5s overlap absorbs clock skew)
    await knex.raw(
        `INSERT INTO ?? SELECT * FROM ?? WHERE ?? >= ?::timestamp - INTERVAL '5 seconds' ON CONFLICT (id, ??) DO NOTHING`,
        [partitioned, sourceTable, partitionColumn, snapshotTs, partitionColumn]
    );

    // 9.5) Capture all views/materialized views that depend on sourceTable, then drop
    // them so that step 10 (rename) and step 11 (DROP TABLE legacy) can proceed without
    // dependency errors. Views are recreated in step 13 after the swap, where they will
    // automatically resolve against the renamed (now-partitioned) sourceTable.
    const dependentViews = await getDependentViews(knex, sourceTable);
    for (const v of dependentViews) {
        const cmd = v.kind === 'm' ? 'DROP MATERIALIZED VIEW' : 'DROP VIEW';
        // qualified_name already comes safely quoted via quote_ident from SQL — direct
        // interpolation is intentional and correct here.
        await knex.raw(`${cmd} IF EXISTS ${v.qualified_name}`);
    }

    // 10) Atomic rename swap
    await knex.raw(`ALTER TABLE ?? RENAME TO ??`, [sourceTable, legacy]);
    await knex.raw(`ALTER TABLE ?? RENAME TO ??`, [partitioned, sourceTable]);

    // 11) Drop legacy (data is already in partitions)
    await knex.raw(`DROP TABLE ??`, [legacy]);

    // 12) Re-create FKs on the partitioned parent (propagates to all partitions)
    for (const fk of foreignKeys) {
        await knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??(??)`, [
            sourceTable,
            fk.constraintName,
            fk.column,
            fk.refTable,
            fk.refColumn,
        ]);
    }

    // 13) Recreate dependent views in reverse order (base views first). After the rename
    // swap, sourceTable now points to the partitioned table, so recreated views will
    // correctly reference the partitioned table going forward.
    // pg_get_viewdef returns the SELECT body (may include a trailing semicolon — that
    // is harmless inside knex.raw).
    for (const v of [...dependentViews].reverse()) {
        const cmd = v.kind === 'm' ? 'CREATE MATERIALIZED VIEW' : 'CREATE VIEW';
        // Escape '?' so Knex does not interpret JSONB '?' operators (?, ?|, ?&) as
        // binding placeholders. The string `\\?` in JS becomes `\?` in the SQL string
        // Knex receives; Knex recognises `\?` as a literal `?` and emits it without
        // binding lookup.
        const safeDefinition = v.definition.replace(/\?/g, '\\?');
        await knex.raw(`${cmd} ${v.qualified_name} AS ${safeDefinition}`);
    }
}

/**
 * Reverse the rename-swap. Re-creates a non-partitioned legacy table using the
 * caller-supplied schema builder, copies data back, swaps names, drops the partitioned tree.
 *
 * Views (regular and materialized) that depend on `sourceTable` are captured before
 * the rename swap and recreated after. After recreation the views reference the restored
 * non-partitioned table (which now owns `sourceTable`'s name).
 *
 * Limitation: view permissions (GRANTs), materialized-view indexes, and ownership are
 * NOT preserved across the drop+recreate cycle. Only the SELECT definition is restored.
 *
 * Costly: full data copy. Documented as emergency rollback only.
 *
 * WARNING: Rows written to `sourceTable` between the bulk INSERT and the subsequent
 * `LOCK TABLE` will be lost after the swap. This is acceptable for an emergency rollback
 * but means writes must be paused (or the application stopped) for the duration of this
 * function. Do not invoke during normal operation.
 *
 * IMPORTANT: This function uses `SET LOCAL` to scope the lock timeout to the current
 * transaction. The calling migration MUST NOT export `config = { transaction: false }`
 * — doing so silently downgrades the lock-timeout safety net to session-level scope.
 *
 * @param {import('knex').Knex} knex
 * @param {{
 *   sourceTable: string,
 *   schemaBuilder: (table: import('knex').Knex.TableBuilder) => void,
 * }} opts
 */
export async function restoreToNonPartitioned(knex, opts) {
    if (knex.client.config.client !== 'pg') {
        return;
    }

    const { sourceTable, schemaBuilder } = opts;
    const restored = `${sourceTable}_restored`;
    const partitioned = `${sourceTable}_partitioned_legacy`;

    // Drop non-PK indexes on sourceTable before creating the restored table.
    // Index names are schema-scoped in PostgreSQL: if sourceTable still exists while
    // we CREATE the restored table, any shared index name causes "relation already exists".
    // These indexes will be recreated by schemaBuilder on the restored table, and the
    // source table is dropped at the end of this function anyway.
    const { rows: idxRows } = await knex.raw(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = current_schema()
           AND tablename = ?
           AND indexname NOT IN (
               SELECT conname FROM pg_constraint
               WHERE conrelid = ?::regclass AND contype = 'p'
           )`,
        [sourceTable, sourceTable]
    );
    for (const { indexname } of idxRows) {
        await knex.raw(`DROP INDEX IF EXISTS ??`, [indexname]);
    }

    // Capture all views/materialized views that depend on sourceTable. We do this
    // before creating the restored table so the captured definitions still reference
    // sourceTable correctly (no rename has happened yet). The actual DROP is deferred
    // to just before the rename swap to minimise view downtime.
    const dependentViews = await getDependentViews(knex, sourceTable);

    // Build non-partitioned table with original schema
    await knex.schema.createTable(restored, schemaBuilder);

    // Copy all data back
    await knex.raw(`INSERT INTO ?? SELECT * FROM ??`, [restored, sourceTable]);

    // Swap names
    // SET LOCAL: resets at end of TX. Timeout applies to lock acquisition only, not to lock duration.
    await knex.raw(`SET LOCAL lock_timeout = '10s'`);
    await knex.raw(`LOCK TABLE ?? IN ACCESS EXCLUSIVE MODE`, [sourceTable]);

    // Drop captured views immediately before the rename so the swap and subsequent
    // DROP TABLE can proceed without dependency errors.
    for (const v of dependentViews) {
        const cmd = v.kind === 'm' ? 'DROP MATERIALIZED VIEW' : 'DROP VIEW';
        // qualified_name already comes safely quoted via quote_ident from SQL — direct
        // interpolation is intentional and correct here.
        await knex.raw(`${cmd} IF EXISTS ${v.qualified_name}`);
    }

    await knex.raw(`ALTER TABLE ?? RENAME TO ??`, [sourceTable, partitioned]);
    await knex.raw(`ALTER TABLE ?? RENAME TO ??`, [restored, sourceTable]);

    // Drop the partitioned tree (cascades to all partitions). CASCADE is no longer
    // needed for views — they were dropped explicitly above — but still required to
    // remove the partition child tables that are attached to the partitioned parent.
    await knex.raw(`DROP TABLE ?? CASCADE`, [partitioned]);

    // Recreate dependent views in reverse order (base views first). After the rename
    // swap, sourceTable now points to the restored non-partitioned table, so recreated
    // views will correctly reference it going forward.
    for (const v of [...dependentViews].reverse()) {
        const cmd = v.kind === 'm' ? 'CREATE MATERIALIZED VIEW' : 'CREATE VIEW';
        // Escape '?' so Knex does not interpret JSONB '?' operators (?, ?|, ?&) as
        // binding placeholders. The string `\\?` in JS becomes `\?` in the SQL string
        // Knex receives; Knex recognises `\?` as a literal `?` and emits it without
        // binding lookup.
        const safeDefinition = v.definition.replace(/\?/g, '\\?');
        await knex.raw(`${cmd} ${v.qualified_name} AS ${safeDefinition}`);
    }
}
