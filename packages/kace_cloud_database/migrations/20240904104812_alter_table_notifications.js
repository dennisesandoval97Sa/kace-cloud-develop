/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.renameTable('notificaciones', 'user_notifications');

    await knex.schema.table('user_notifications', function (table) {
        table.timestamp('fecha_inicio').alter();
        table.timestamp('fecha_fin').alter();

        table.dropColumn('especificaciones');

        table.boolean('is_active');
        table.dropColumn('status');

        table.timestamp('created_at').defaultTo(null).alter();
        table.timestamp('updated_at').defaultTo(null).alter();

        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.renameTable('user_notifications', 'notificaciones');

    await knex.schema.table('notificaciones', function (table) {
        table.date('fecha_inicio').alter();
        table.date('fecha_fin').alter();

        table.jsonb('especificaciones');

        table.smallint('status');
        table.dropColumn('is_active');

        table.dropColumn('deleted_by');

        table.timestamp('created_at').defaultTo(knex.fn.now()).alter();
        table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
    });
}
