export async function up(knex) {
    await knex.schema.table('grupos', (table) => {
        table.string('configuration_id', 255).nullable();
        table.foreign('configuration_id').references('id').inTable('global_configurations').onDelete('SET NULL');
    });
}

export async function down(knex) {
    await knex.schema.table('grupos', (table) => {
        table.dropForeign('configuration_id');
        table.dropColumn('configuration_id');
    });
}
