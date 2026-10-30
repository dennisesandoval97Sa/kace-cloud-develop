/**
 * Eliminación de tablas de tableros y sus historiales asociados.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    // Historiales
    if (knex.client.config.client === 'sqlite3') {
        await knex.raw('DROP TABLE IF EXISTS history_board_access_groups');
        await knex.raw('DROP TABLE IF EXISTS history_board_columns');
        await knex.raw('DROP TABLE IF EXISTS history_board_options');
        await knex.raw('DROP TABLE IF EXISTS history_board_relations');

        // Tablas principales
        await knex.raw('DROP TABLE IF EXISTS board_access_groups');
        await knex.raw('DROP TABLE IF EXISTS board_columns');
        await knex.raw('DROP TABLE IF EXISTS board_options');
        await knex.raw('DROP TABLE IF EXISTS board_relations');
    } else {
        await knex.raw('DROP TABLE IF EXISTS history_board_access_groups CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS history_board_columns CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS history_board_options CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS history_board_relations CASCADE;');

        // Tablas principales
        await knex.raw('DROP TABLE IF EXISTS board_access_groups CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS board_columns CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS board_options CASCADE;');
        await knex.raw('DROP TABLE IF EXISTS board_relations CASCADE;');
    }
}

/**
 * Restauración de tablas eliminadas si se hace rollback.
 * NOTA: aquí normalmente se recrean las tablas y sus historiales
 * con sus esquemas originales.
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {

    // Tablas principales
    await knex.schema.createTable('board_access_groups', table => {
        table.string('board_id', 36).notNullable()
        table.string('group_id', 36).notNullable();
        table.primary(['board_id', 'group_id']);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);


        table.foreign('board_id').references('id').inTable('boards');
        table.foreign('group_id').references('id').inTable('grupos');
    });
    await knex.schema.createTable('board_columns', table => {
        table.string('id', 36).primary();
        table.string('board_id', 36)
        table.string('expression', 255)
        table.string('alias', 80)
        table.integer('position');
        table.boolean('is_filterable')
        table.string('data_type', 80);
        table.string('format', 50);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('board_id').references('id').inTable('boards');
    });
    await knex.schema.createTable('board_options', (table) => {
        table.string('id', 36).primary();
        table.string('board_id', 36)
        table.string('type', 36)
        table.string('ref_id', 36)
        table.string('label', 120);
        table.boolean('requires_confirmation')
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);

        table.foreign('board_id').references('id').inTable('boards');
    });
    await knex.schema.createTable('board_relations', table => {
        table.string('id').primary();
        table.string('board_id', 36)
        table.string('related_entity', 80)
        table.string('join_type', 80)
        table.jsonb('on')
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
        table.foreign('board_id').references('id').inTable('boards');

    });

    // Historiales
    await knex.schema.createTable('history_board_access_groups', (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });
    await knex.schema.createTable('history_board_columns', (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });
    await knex.schema.createTable('history_board_options', (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });
    await knex.schema.createTable('history_board_relations', (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });

}
