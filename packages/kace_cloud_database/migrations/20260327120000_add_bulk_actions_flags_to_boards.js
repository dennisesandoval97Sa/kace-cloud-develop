export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.boolean('can_admin_bulk_actions').notNullable().defaultTo(false);
        table.boolean('can_agent_bulk_actions').notNullable().defaultTo(false);
    });
}

export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('can_admin_bulk_actions');
        table.dropColumn('can_agent_bulk_actions');
    });
}
