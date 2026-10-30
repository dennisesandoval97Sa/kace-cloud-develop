export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.boolean('can_admin_delete_record').notNullable().defaultTo(false);
        table.boolean('can_agent_delete_record').notNullable().defaultTo(false);
    });
}

export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('can_admin_delete_record');
        table.dropColumn('can_agent_delete_record');
    });
}
