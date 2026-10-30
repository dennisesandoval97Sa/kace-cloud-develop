/**
 * @param {import('knex').Knex} knex
 */
export const up = async (knex) => {
    await knex.schema.alterTable('emails', (table) => {
        table.string('subject', 500).alter();
    });
};

/**
 * @param {import('knex').Knex} knex
 */
export const down = async (knex) => {
    await knex('emails')
        .whereRaw('LENGTH(subject) > 120')
        .update({ subject: knex.raw('substr(subject, 1, 120)') });
    await knex.schema.alterTable('emails', (table) => {
        table.string('subject', 120).alter();
    });
};
