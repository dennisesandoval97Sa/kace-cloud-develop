/**
 * Lookup indexes the folio tables were created without (Guía A §6.4):
 * - `clasificaciones.folio_config_id`: the classifications attached to a configuration
 *   (GET /folio-configurations/{id}/classifications) and the check that refuses to delete one
 *   still in use.
 * - `history_folio_configurations.entity_id`: the history of a configuration, which
 *   `findCompetingLayouts` reads to know the narrowest consecutive it issued with.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('clasificaciones', (table) => {
        table.index('folio_config_id', 'idx_clasificaciones_folio_config_id');
    });
    await knex.schema.table('history_folio_configurations', (table) => {
        table.index('entity_id', 'idx_history_folio_configurations_entity_id');
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('history_folio_configurations', (table) => {
        table.dropIndex('entity_id', 'idx_history_folio_configurations_entity_id');
    });
    await knex.schema.table('clasificaciones', (table) => {
        table.dropIndex('folio_config_id', 'idx_clasificaciones_folio_config_id');
    });
}
