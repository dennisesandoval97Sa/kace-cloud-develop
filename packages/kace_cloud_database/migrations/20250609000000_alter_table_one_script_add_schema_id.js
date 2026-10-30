/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('one-script', (table) => {
        table.string('schema_id', 36).references('id').inTable('schemas');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('one-script', (table) => {
        table.dropColumn('schema_id');
    });
}
