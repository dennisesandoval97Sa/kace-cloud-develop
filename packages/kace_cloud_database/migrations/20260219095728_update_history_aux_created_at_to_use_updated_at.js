/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const isSQLite = knex.client.config.client === 'sqlite3';
    if (!isSQLite) {
        const schemaResult = await knex.raw(`SELECT current_schema() AS schema_name`);
        const schemaRows = schemaResult.rows ?? schemaResult;
        const schemaName =
            Array.isArray(schemaRows) && schemaRows[0] ? schemaRows[0].schema_name : process.env.DB_SCHEMA;

        const result = await knex.raw(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = ?
               AND table_name LIKE 'history_aux_%'`,
            [schemaName]
        );
        const rows = result.rows ?? result;
        const tableNames = (Array.isArray(rows) ? rows : []).map((r) => r.table_name);

        for (const tableName of tableNames) {
            await knex.raw(
                `
                    UPDATE ??
                    SET created_at = COALESCE(
                            (new_attributes ->>'updated_at') ::timestamptz,
                            (new_attributes ->>'created_at') ::timestamptz
                                     ),
                        created_by = COALESCE(
                                new_attributes ->>'updated_by',
                    new_attributes->>'created_by'
                )
                    WHERE new_attributes IS NOT NULL
                      AND (
                        new_attributes ->>'updated_at' IS NOT NULL
                            OR new_attributes->>'created_at' IS NOT NULL
                            OR new_attributes->>'updated_by' IS NOT NULL
                            OR new_attributes->>'created_by' IS NOT NULL
                        )
                `,
                [tableName]
            );
        }
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return;
}
