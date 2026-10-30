/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('agendas', (table) => {
        table.string('one_script_id', 36).nullable().alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('agendas', (table) => {
        table.string('one_script_id', 36).notNullable().alter();
    });
}
