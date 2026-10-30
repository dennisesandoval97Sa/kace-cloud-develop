export async function up(knex) {
    await knex.schema.alterTable('history_cases', (table) => {
        table.string('created_by', '36').alter();
        table.string('updated_by', '36').alter();
    });
}

export async function down(knex) {
    await knex.schema.alterTable('history_cases', (table) => {
        table.bigint('created_by').alter();
        table.bigint('updated_by').alter();
    });
}
