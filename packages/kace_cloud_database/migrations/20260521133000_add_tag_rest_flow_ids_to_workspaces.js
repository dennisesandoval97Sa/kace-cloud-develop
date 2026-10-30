/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.alterTable('workspaces', (table) => {
        table.string('tag_creation_flow_id', 36).nullable();
        table.string('tag_update_flow_id', 36).nullable();
        table.string('tag_deletion_flow_id', 36).nullable();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.alterTable('workspaces', (table) => {
        table.dropColumn('tag_creation_flow_id');
        table.dropColumn('tag_update_flow_id');
        table.dropColumn('tag_deletion_flow_id');
    });
}
