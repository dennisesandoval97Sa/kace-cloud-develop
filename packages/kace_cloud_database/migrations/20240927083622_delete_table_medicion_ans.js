/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropTableIfExists('medicion_ans');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.createTable('medicion_ans', function (table) {
        table.string('id', 36).primary();
        table.string('descripcion', 100);
    });
}
