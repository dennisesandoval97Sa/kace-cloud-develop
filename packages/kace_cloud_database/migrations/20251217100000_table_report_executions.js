/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('report_executions', function(table) {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable(); 
    table.string('issued_by', 36).notNullable() 
      .references('id').inTable('usuarios');
    if (knex.client.config.client === 'sqlite3') {
      table.text('period');
      table.text('conditions');
    } else {
      table.jsonb('period').notNullable(); 
      table.jsonb('conditions'); 
    }
    
    table.text('s3_file'); 
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
  await knex.schema.dropTableIfExists('report_executions');
};
