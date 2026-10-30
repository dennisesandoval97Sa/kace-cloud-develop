/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('boards', function (table) {
        table.string('id',36).primary();
        table.string('name', 120)
        table.text('description')
        table.string('primary_entity', 80)
        table.jsonb('criteria')
        table.integer('page_size')
        table.boolean('is_active')
        table.string('icon_class', 80)
        table.string('onescript_form_id', 36)
        table.json('relations')
        table.json('columns')
        table.json('access_groups')
        table.json('options')
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('boards');
}

