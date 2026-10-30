/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('case_session_durations', function(table) {
    table.string('id', 36).primary();
    table.string('case_id', 36).notNullable()
      .references('id').inTable('cases');

    table.string('user_id', 36).notNullable()
      .references('id').inTable('usuarios');
      
    table.timestamp('started_at').notNullable();
    table.timestamp('finished_at');
    table.string('event_type', 20);
    table.text('justification');
    table.specificType('elapsed_time', 'interval');
    table.timestamp('created_at');
    table.string('created_by', 36);
    table.timestamp('updated_at');
    table.string('updated_by', 36);
    table.timestamp('deleted_at');
    table.string('deleted_by', 36);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {  
  await knex.schema.dropTableIfExists('case_session_durations');
};
