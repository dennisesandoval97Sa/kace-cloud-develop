/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex('actions').whereNull('entity').update({ entity: 'case' });

    await knex.schema.alterTable('actions', (table) => {
        table.string('entity', 255).notNullable().defaultTo('case').alter();
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('actions', (table) => {
        table.string('entity', 255).nullable().alter();
    });
    // Backfill is intentionally not reverted — we cannot reconstruct which rows were originally NULL.
}
