/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('actions', (table) => {
        table.string('external_group_code', 500).alter();
        table.string('external_user_code', 500).alter();
        table.string('external_group_dynamic_code', 500).nullable();
        table.string('external_user_dynamic_code', 500).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('actions', (table) => {
        table.string('external_group_code', 200).alter();
        table.string('external_user_code', 200).alter();
        table.dropColumn('external_group_dynamic_code');
        table.dropColumn('external_user_dynamic_code');
    });
}
