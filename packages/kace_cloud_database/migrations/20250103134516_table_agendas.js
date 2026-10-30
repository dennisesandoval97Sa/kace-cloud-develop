/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('agendas', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255).notNullable();
        table.boolean('is_active').notNullable();
        table.string('one_script_id', 36).notNullable();
        table.integer('daily_limit').notNullable();
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');

        table.foreign('one_script_id').references('id').inTable('one-script');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('agendas');
}
