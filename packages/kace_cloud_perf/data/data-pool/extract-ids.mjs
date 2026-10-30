import { writeFileSync } from 'node:fs';
import pg from 'pg';

const DEFAULT_EXCLUDE_SUFFIXES = ['_log', '_history', '_event', '_audit'];

function normalizeExcludeSuffix(s) {
    return s.startsWith('_') ? s : `_${s}`;
}

export function buildIntrospectionQuery({ excludeSuffixes = DEFAULT_EXCLUDE_SUFFIXES } = {}) {
    const excludeClauses = excludeSuffixes
        .map((s) => `  AND t.table_name NOT LIKE '%\\${normalizeExcludeSuffix(s)}' ESCAPE '\\'`)
        .join('\n');

    return `
SELECT t.table_name
FROM information_schema.tables t
JOIN information_schema.columns c_id ON c_id.table_schema = t.table_schema
    AND c_id.table_name = t.table_name AND c_id.column_name = 'id'
JOIN information_schema.columns c_del ON c_del.table_schema = t.table_schema
    AND c_del.table_name = t.table_name AND c_del.column_name = 'deleted_at'
WHERE t.table_schema = $1
  AND t.table_type = 'BASE TABLE'
  AND (
      c_id.data_type = 'uuid'
      OR (c_id.udt_name IN ('varchar', 'bpchar') AND c_id.character_maximum_length = 36)
  )
  AND c_del.data_type LIKE 'timestamp%'
${excludeClauses}
ORDER BY t.table_name;
`.trim();
}

const ALLOWED_TABLES = new Set(['cases', 'usuarios', 'clients', 'grupos', 'clasificaciones', 'estados']);

// Postgres identifier rules (for QUOTED identifiers): we accept alphanumerics,
// underscores, and hyphens. Must start with a letter or underscore. Max 63 chars.
// Hyphens are SQL-safe inside double-quoted identifiers (which is how the
// queries below are built: `"${schema}"."${table}"`).
const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/;

function assertValidIdentifier(name, label) {
    if (typeof name !== 'string' || !IDENTIFIER_RE.test(name)) {
        throw new Error(`invalid ${label}: ${name}`);
    }
}

export async function extractIds({ client, table, schema, limit }) {
    if (limit <= 0) {
        throw new Error('limit must be > 0');
    }
    assertValidIdentifier(table, 'table');
    assertValidIdentifier(schema, 'schema');
    const sql = `SELECT id
                 FROM "${schema}"."${table}"
                 WHERE deleted_at IS NULL
                 ORDER BY id LIMIT $1`;
    const result = await client.query(sql, [limit]);
    return result.rows.map((row) => row.id);
}

async function discoverTables(client, schema, opts = {}) {
    const sql = buildIntrospectionQuery(opts);
    const result = await client.query(sql, [schema]);
    return result.rows.map((r) => r.table_name);
}

function parseCliArgs(argv) {
    const introspect = argv.includes('--introspect');
    const tablesIdx = argv.indexOf('--tables');
    const tablesArg =
        tablesIdx !== -1 && argv[tablesIdx + 1]
            ? argv[tablesIdx + 1]
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
            : null;
    return { introspect, tablesArg };
}

async function runCli() {
    const { Client } = pg;
    const schema = process.env.PERF_DB_SCHEMA;
    if (!schema) {
        console.error('PERF_DB_SCHEMA must be set.');
        process.exit(1);
    }

    const { introspect, tablesArg } = parseCliArgs(process.argv);

    const client = new Client({
        host: process.env.PERF_DB_HOST,
        port: Number(process.env.PERF_DB_PORT ?? 5432),
        database: process.env.PERF_DB_NAME,
        user: process.env.PERF_DB_USER,
        password: process.env.PERF_DB_PASSWORD,
    });
    await client.connect();

    try {
        const limit = Number(process.env.PERF_DATA_POOL_LIMIT ?? 1000);

        let tables;
        if (tablesArg) {
            tables = tablesArg;
            console.error(`Using ${tables.length} tables from --tables`);
        } else if (introspect) {
            tables = await discoverTables(client, schema);
            console.error(`Discovered ${tables.length} tables via introspection`);
        } else {
            tables = [...ALLOWED_TABLES];
        }

        for (const table of tables) {
            const ids = await extractIds({ client, table, schema, limit });
            const out = `./data/data-pool/${table}.local.json`;
            writeFileSync(out, JSON.stringify(ids, null, 4));
            console.error(`Wrote ${ids.length} ids to ${out}`);
        }
    } finally {
        await client.end();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
