export async function up(knex) {
    await knex.schema.table('usuarios', function (table) {
        table.dropColumn('password');
        table.dropColumn('password_reset_token');
    });
}

export function down(knex) {
    return knex.schema.table('usuarios', function (table) {
        table.string('password', 200);
        table.string('password_reset_token', 255);
    });
}
