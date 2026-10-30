/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('workspaces_grupos_relations', (table) => {
        table.string('workspace_id', 36).notNullable();
        table.string('grupo_id', 36).notNullable();

        table.primary(['workspace_id', 'grupo_id']);
        table.foreign('workspace_id').references('id').inTable('workspaces');
        table.foreign('grupo_id').references('id').inTable('grupos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('workspaces_grupos_relations');
}
