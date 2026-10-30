export async function up(knex) {
    await knex.schema.alterTable('clientes', (table) => {
        table.string('documento', 45).alter();
        table.string('tipo_documento', 45).alter();
    });
}

export async function down(knex) {
    await knex.schema.alterTable('clientes', (table) => {
        table.string('documento', 25).alter();
        table.string('tipo_documento', 25).alter();
    });
}
