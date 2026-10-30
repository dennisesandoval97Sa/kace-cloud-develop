export async function up(knex) {
    await knex.schema.alterTable('casos', function (table) {
        table.timestamp('closed_at');
        table.string('closed_by', 36);
    });
}

export async function down(knex) {
    await knex.schema.alterTable('casos', function (table) {
        table.dropColumn('closed_at');
        table.dropColumn('closed_by');
    });
}
