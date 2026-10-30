/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.table('banners', function (table) {
        table.jsonb('propiedades').alter();
        table.jsonb('especificaciones').alter();
        table.timestamp('created_at').defaultTo(null).alter();
        table.timestamp('updated_at').defaultTo(null).alter();
    });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.table('banners', function (table) {
        table.json('propiedades').alter();
        table.json('especificaciones').alter();
        table.timestamp('created_at').defaultTo(knex.fn.now()).alter();
        table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
    });
}
