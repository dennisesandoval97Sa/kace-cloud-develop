/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('agendas', (table) => {
        table
            .boolean('is_for_weekend')
            .defaultTo(false)
            .notNullable()
            .comment('Whether the agenda is for weekend or not');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('agendas', (table) => {
        table.dropColumn('is_for_weekend');
    });
}
