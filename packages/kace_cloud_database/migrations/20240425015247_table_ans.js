/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('ans', function (table) {
        table.string('id', 36).primary();
        table.string('nombre', 100);
        table.integer('intermedio');
        table.integer('vencido');
        table.string('color_ans_inicial', 20);
        table.string('color_ans_intermedio', 20);
        table.string('color_ans_final', 20);
        table.smallint('status');
        table.string('medicion_ans_id', 36);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('created_by', 36).unsigned();
        table.string('updated_by', 36).unsigned();

        table.foreign('medicion_ans_id').references('id').inTable('medicion_ans');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('ans');
}
