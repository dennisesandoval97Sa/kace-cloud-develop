/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('appointments', (table) => {
        table.string('id', 36).primary();
        table.string('case_id', 36).notNullable();
        table.string('agenda_id', 36).notNullable();
        table.date('date').notNullable();
        table.timestamp('start_time').notNullable();
        table.timestamp('end_time').notNullable();
        table.string('last_appointment_id', 36);
        table.boolean('is_completed').defaultTo(false);
        table.boolean('is_canceled').defaultTo(false);
        table.jsonb('custom_fields');
        table.string('assigned_to', 36);
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');

        table.foreign('case_id').references('id').inTable('casos');
        table.foreign('agenda_id').references('id').inTable('agendas');
        table.foreign('assigned_to').references('id').inTable('usuarios');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('appointments');
}
