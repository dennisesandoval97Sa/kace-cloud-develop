/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('report_executions', function (table) {
        table.string('status', 20);
        table.jsonb('result');
        table.jsonb('error');
        table.timestamp('started_at');
        table.timestamp('completed_at');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.alterTable('report_executions', function (table) {
        table.dropColumn('status');
        table.dropColumn('result');
        table.dropColumn('error');
        table.dropColumn('started_at');
        table.dropColumn('completed_at');
    });
}
