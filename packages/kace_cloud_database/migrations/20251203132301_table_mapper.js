/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
	await knex.schema.createTable('broker_message_mappers', (table) => {
		table.string('id', 36).primary();
		table.string('name', 255).notNullable().unique();
		table.string('rest_flow_id', 255).nullable();
		table.timestamp('created_at').defaultTo(knex.fn.now());
		table.string('created_by', 36).nullable();
		table.timestamp('updated_at').nullable();
		table.string('updated_by', 36).nullable();
		table.timestamp('deleted_at').nullable();
		table.string('deleted_by', 36).nullable();
	});
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
	await knex.schema.dropTableIfExists('broker_message_mappers');
}
