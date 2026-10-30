/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export function up(knex) {
    return knex.schema.createTable('clasificaciones', function (table) {
        table.string('id', 36).primary();
        table.string('nivel1', 100);
        table.string('nivel2', 100);
        table.string('nivel3', 100);
        table.string('nivel4', 100);
        table.string('nivel5', 100);
        table.string('nivel6', 100);
        table.string('nivel7', 100);
        table.string('nivel8', 100);
        table.string('nivel9', 100);
        table.string('nivel10', 100);
        table.string('flujo_id', 36);
        table.string('ans_id', 36);
        table.boolean('is_active');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('flujo_id').references('id').inTable('flujos');
        table.foreign('ans_id').references('id').inTable('ans');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export function down(knex) {
    return knex.schema.dropTable('clasificaciones');
}
