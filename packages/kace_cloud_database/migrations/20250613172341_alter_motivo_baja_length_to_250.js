/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('casos', function (table) {
        table.string('motivo_baja', 255).alter();
    });
    await knex.schema.alterTable('fake_cases', function (table) {
        table.string('motivo_baja', 255).alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('casos', function (table) {
        table.string('motivo_baja', 50).alter();
    });
    await knex.schema.alterTable('fake_cases', function (table) {
        table.string('motivo_baja', 50).alter();
    });
}
