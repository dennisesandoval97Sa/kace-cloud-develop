/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('history_rel_usuarios_grupos', (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
        table.index('entity_id', 'idx_history_rel_usuarios_grupos_entity_id');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('history_rel_usuarios_grupos');
}
