/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('client_notifications', function (table) {
        table.string('id', 36).primary();
        table.string('client_id', 36).notNullable();
        table.string('subject', 25);
        table.string('message', 1000);
        table.timestamp('start_date');
        table.timestamp('end_date');
        table.boolean('is_read');
        table.string('read_by', 36);
        table.boolean('is_active');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('client_id').references('id').inTable('clientes');
        table.foreign('read_by').references('id').inTable('usuarios');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('client_notifications');
}
