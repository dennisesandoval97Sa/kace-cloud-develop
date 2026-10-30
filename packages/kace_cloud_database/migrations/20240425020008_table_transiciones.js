/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('transiciones', function (table) {
        table.string('id', 36).primary();
        table.string('estado_actual_id', 36);
        table.string('siguiente_estado_id', 36);
        table.string('flujo_id', 36);
        table.smallint('status');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();

        table.foreign('estado_actual_id').references('id').inTable('estados');
        table.foreign('siguiente_estado_id').references('id').inTable('estados');
        table.foreign('flujo_id').references('id').inTable('flujos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('transiciones');
}
