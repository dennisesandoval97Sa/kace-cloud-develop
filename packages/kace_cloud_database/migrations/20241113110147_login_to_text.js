export async function up(knex) {
    await knex.schema.table('usuarios', (table) => {
        table.text('login').alter();
    });
}

export async function down(knex) {
    await knex.schema.table('usuarios', (table) => {
        table.string('login', 32).alter();
    });
}
