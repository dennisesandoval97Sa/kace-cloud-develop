export async function up(knex) {
    await knex.schema.createTable('quick_links', (table) => {
        table.string('id', 36).primary();
        table.string('title', 100);
        table.string('url', 500);
        table.integer('position');

        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);

        table.index(['deleted_at', 'position'], 'quick_links_active_order_idx');
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('quick_links');
}
