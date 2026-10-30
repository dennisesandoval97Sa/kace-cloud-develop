/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('one-script', (table) => {
        table.string('onescript_reference_id', 36).nullable();
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('one-script', (table) => {
        table.dropColumn('onescript_reference_id');
    });
}
