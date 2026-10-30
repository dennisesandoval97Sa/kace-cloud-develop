/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('geolocation', function (table) {
        table.string('id', 36).primary().notNullable();
        table.string('user_id', 36).notNullable().references('id').inTable('usuarios').onDelete('CASCADE');
        table.string('action_type', 255).notNullable();
        table.string('longitud', 100).notNullable();
        table.string('latitud', 100).notNullable();
        table.string('ip4_address', 15).notNullable();
        table.jsonb('metadata');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('geolocation');
}
