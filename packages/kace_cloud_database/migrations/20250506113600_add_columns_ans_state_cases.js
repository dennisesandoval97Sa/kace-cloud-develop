/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('casos', (table) => {
        table.timestamp('state_change_at').nullable();
        table.integer('state_elapsed_days').nullable();
        table.integer('state_elapsed_hours').nullable();
        table.integer('state_elapsed_minutes').nullable();
        table.string('state_elapsed_time', 100).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('casos', (table) => {
        table.dropColumn('state_change_at');
        table.dropColumn('state_elapsed_days');
        table.dropColumn('state_elapsed_hours');
        table.dropColumn('state_elapsed_minutes');
        table.dropColumn('state_elapsed_time');
    });
}
