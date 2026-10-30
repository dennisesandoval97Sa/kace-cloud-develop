export function up(knex) {
    return knex.schema.alterTable('interactions', (table) => {
        table.boolean('is_migrated').notNullable().defaultTo(false);
    });
}

export function down(knex) {
    return knex.schema.alterTable('interactions', (table) => {
        table.dropColumn('is_migrated');
    });
}
