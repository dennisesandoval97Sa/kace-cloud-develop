/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('broker_message_mapper_rules', (table) => {
        table.string('parse_to', 50).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('broker_message_mapper_rules', (table) => {
        table.dropColumn('parse_to');
    });
}
