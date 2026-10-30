export async function up(knex) {
    await knex.schema.table('plantillas', (table) => {
        table.boolean('enviar_adjuntos_del_caso').notNullable().defaultTo(false);
    });
}

export async function down(knex) {
    await knex.schema.table('plantillas', (table) => {
        table.dropColumn('enviar_adjuntos_del_caso');
    });
}
