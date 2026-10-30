/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.table('estados', (table) => {
        table.renameColumn('icono_awesome_id', 'icon_class');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.table('estados', (table) => {
        table.renameColumn('icon_class', 'icono_awesome_id');
    });
}
