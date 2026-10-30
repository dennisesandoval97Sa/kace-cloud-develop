/**
 * Links a classification to the folio configuration that must generate the folio of its
 * cases. Nullable: a classification without configuration keeps producing cases with a
 * null folio, which is the pre-existing behaviour.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('clasificaciones', (table) => {
        table.string('folio_config_id', 36).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('clasificaciones', (table) => {
        table.dropColumn('folio_config_id');
    });
}
