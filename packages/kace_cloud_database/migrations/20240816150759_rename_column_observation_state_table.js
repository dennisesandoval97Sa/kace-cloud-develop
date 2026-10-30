/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('estados', (table) => {
        table.renameColumn('observacion', 'require_observation');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('estados', (table) => {
        table.renameColumn('require_observation', 'observacion');
    });
}
