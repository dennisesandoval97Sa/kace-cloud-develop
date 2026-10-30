export async function up(knex) {
    return knex.schema.createTable('fake_clients', function (table) {
        table.string('id', 36).notNullable().primary();
        table.string('tipo_cliente', 100);
        table.string('tipo_documento', 45);
        table.string('documento', 45);
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
        table.integer('status');
        table.string('padre_id', 36);
        table.string('habeas_data', 10);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

export async function down(knex) {
    return knex.schema.dropTable('fake_clients');
}
