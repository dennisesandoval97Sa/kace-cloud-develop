/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('rel_usuarios_grupos_history', (table) => {
        table.string('id', 36).primary();
        table.jsonb('condition');
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('rel_usuarios_grupos_history');
}
