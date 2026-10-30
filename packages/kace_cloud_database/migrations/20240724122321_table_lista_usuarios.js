/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('lista_usuarios', function (table) {
        table.string('id', 36).primary();
        table.string('descripcion', 255).notNullable();
        table.jsonb('lista_usuarios').notNullable();
        table.boolean('is_active').notNullable();
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
    return knex.schema.dropTableIfExists('lista_usuarios');
}
