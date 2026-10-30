/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

export function up(knex) {
    return knex.schema.createTable('clientes', function (table) {
        table.string('id', 36).primary();
        table.string('tipo_cliente', 100);
        table.string('tipo_documento', 10);
        table.string('documento', 25);
        table.string('nombres', 100);
        table.string('apellido1', 100);
        table.string('apellido2', 100);
        table.string('nombre_empresa', 200);
        table.string('sexo', 15);
        table.string('estado_civil', 15);
        table.date('fecha_nacimiento');
        table.string('email', 200);
        table.string('email_alterno', 200);
        table.string('telefono', 15);
        table.string('telefono_alterno', 15);
        table.string('campos_extra1', 100);
        table.string('campos_extra2', 100);
        table.string('campos_extra3', 100);
        table.integer('status', 10);
        table.string('padre_id', 36);
        table.string('habeas_data', 10);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();

        table.foreign('padre_id').references('id').inTable('clientes');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('clientes');
}
