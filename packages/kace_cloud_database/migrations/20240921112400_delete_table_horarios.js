export async function up(knex) {
    await knex.schema.dropTable('horarios');
}

export async function down(knex) {
    await knex.schema.createTable('horarios', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 100);
        table.smallint('status');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();
    });
}
