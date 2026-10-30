/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('estados', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 50);
        table.integer('tipo_id');
        table.string('descripcion', 1000);
        table.bigInteger('icono_awesome_id');
        table.smallint('status');
        table.string('color', 20);
        table.boolean('observacion');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('estados');
}
