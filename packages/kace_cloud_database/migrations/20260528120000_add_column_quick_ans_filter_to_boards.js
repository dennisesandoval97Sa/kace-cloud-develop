const DEFAULT_QUICK_ANS_FILTER = {
    enabled: false,
    ans_column_alias: '',
    labels: { 1: '', 2: '', 3: '' },
    use_default_colors: true,
    colors: { 1: '', 2: '', 3: '' },
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.jsonb('quick_ans_filter').notNullable().defaultTo(JSON.stringify(DEFAULT_QUICK_ANS_FILTER));
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('boards', (table) => {
        table.dropColumn('quick_ans_filter');
    });
}
