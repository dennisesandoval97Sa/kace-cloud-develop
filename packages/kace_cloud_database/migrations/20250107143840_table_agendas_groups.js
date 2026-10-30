/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('agendas_groups', (table) => {
        table.string('agenda_id', 36).notNullable();
        table.string('group_id', 36).notNullable();
        table.string('created_by', 36);
        table.timestamp('created_at');

        table.primary(['agenda_id', 'group_id']);

        table.foreign('agenda_id').references('id').inTable('agendas');
        table.foreign('group_id').references('id').inTable('grupos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTableIfExists('agendas_groups');
}
