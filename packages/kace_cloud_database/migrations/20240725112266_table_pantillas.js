export function up(knex) {
    return knex.schema.createTable('plantillas', (table) => {
        table.string('id', 36).primary();
        table.string('descripcion', 255).notNullable().unique();
        table.string('ruta', 1000);
        table.integer('tipo');
        table.string('destinatario', 30000);
        table.string('copia', 30000);
        table.string('copia_oculta', 30000);
        table.string('asunto', 1000);
        table.text('cuerpo');
        table.boolean('incluye_adjuntos');
        table.smallint('status');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.timestamp('deleted_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

export function down(knex) {
    return knex.schema.dropTable('plantillas');
}
