/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('rel_usuarios_grupos', (table) => {
        table.string('usuario_id', 36).notNullable();
        table.string('grupo_id', 36).notNullable();

        table.primary(['usuario_id', 'grupo_id']);

        table.foreign('usuario_id').references('id').inTable('usuarios');
        table.foreign('grupo_id').references('id').inTable('grupos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('rel_usuarios_grupos');
}
