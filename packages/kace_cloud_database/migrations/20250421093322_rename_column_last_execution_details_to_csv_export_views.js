/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('csv_export_views', (table) => {
        table.renameColumn('last_execution_details', 'details');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('csv_export_views', (table) => {
        table.renameColumn('details', 'last_execution_details');
    });
}
