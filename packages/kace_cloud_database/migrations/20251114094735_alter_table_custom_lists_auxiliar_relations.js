/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('custom_lists_auxiliar_relations', (table) => {
      table.renameColumn('aux_id', 'literal');
    });

    await knex.schema.alterTable('custom_lists_auxiliar_relations', (table) => {
        table.string('literal', 255).alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('custom_lists_auxiliar_relations', (table) => {
        table.string('literal', 36).alter();
    });
    await knex.schema.alterTable('custom_lists_auxiliar_relations', (table) => {
      table.renameColumn('literal', 'aux_id');
    });
}
