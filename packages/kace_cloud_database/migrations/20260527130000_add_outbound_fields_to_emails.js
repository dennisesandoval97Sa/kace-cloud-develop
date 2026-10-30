/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('emails', (table) => {
        table.string('case_id_outbound', 36).nullable();
        table.integer('case_reference_outbound').nullable();
        table.boolean('is_outbound').notNullable().defaultTo(false);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('emails', (table) => {
        table.dropColumn('case_id_outbound');
        table.dropColumn('case_reference_outbound');
        table.dropColumn('is_outbound');
    });
}
