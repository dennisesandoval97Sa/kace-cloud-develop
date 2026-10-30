export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.string('filter_onescript_id', 36).nullable();
    });
}

export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('filter_onescript_id');
    });
}
