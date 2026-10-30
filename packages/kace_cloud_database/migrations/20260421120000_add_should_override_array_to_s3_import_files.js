/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('s3_import_files', (table) => {
        table.boolean('should_override_array').nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('s3_import_files', (table) => {
        table.dropColumn('should_override_array');
    });
}
