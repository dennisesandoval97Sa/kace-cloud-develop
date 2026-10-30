/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('s3_import_files', (table) => {
        table.string('action_type', 50).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('s3_import_files', (table) => {
        table.dropColumn('action_type');
    });
}

