export function up(knex) {
    return knex.schema.createTable('descripciones_casos', function (table) {
        table.string('id', 36).primary();
        table.text('descripcion');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}

export function down(knex) {
    return knex.schema.dropTable('descripciones_casos');
}
