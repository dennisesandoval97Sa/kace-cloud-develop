/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('historial_casos', (table) => {
        table.string('id', 36).primary();
        table.string('caso_id', 36).unsigned().notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.bigInteger('created_by').unsigned();
        table.bigInteger('updated_by').unsigned();

        table.foreign('caso_id').references('casos.id');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('historial_casos');
}
