export async function up(knex) {
    await knex.schema.createTable('usuarios', function (table) {
        table.string('id', 36).primary();
        table.string('login', 32);
        table.string('nombres', 100);
        table.string('apellido1', 100);
        table.string('apellido2', 100);
        table.string('email', 200);
        table.string('telefono', 20);
        table.string('movil', 20);
        table.string('password', 200);
        table.smallint('status');
        table.string('token', 400);
        table.string('session_id', 100);
        table.string('rol_id', 36).unsigned();
        table.string('password_reset_token', 255);
        table.date('inactivo_desde');
        table.date('inactivo_hasta');
        table.smallint('intento_login');
        table.timestamp('fecha_bloqueo');
        table.bigInteger('grupo_activo');
        table.jsonb('codigos_externos');
        table.string('external_id', 45);
        table.smallint('account_type');
        table.smallint('es_externo');
        table.smallint('envio_correo');
        table.jsonb('grid');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);

        table.foreign('rol_id').references('id').inTable('roles');
    });
    return knex.schema.raw('CREATE INDEX i_usuarios_login ON usuarios (login)');
}

export function down(knex) {
    return knex.schema.dropTable('usuarios');
}
