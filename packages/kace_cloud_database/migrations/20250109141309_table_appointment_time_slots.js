/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('appointment_time_slots', (table) => {
        table.string('id', 36).primary();

        table.string('description', 255).nullable();
        table.time('start_time').notNullable();
        table.time('end_time').notNullable();
        table.string('agenda_id', 36).notNullable();
        table.boolean('is_active').defaultTo(true);
        table.integer('max_appointments').nullable();

        table.uuid('created_by').nullable();
        table.uuid('updated_by').nullable();
        table.uuid('deleted_by').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable();
        table.timestamp('deleted_at').nullable();

        table.foreign('agenda_id').references('id').inTable('agendas');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('appointment_time_slots');
}
