/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
	await knex.schema.createTable('broker_adapters', (table) => {
		table.string('id', 36).primary();
		table.string('name', 255).notNullable().unique();
		table.string('host', 512).notNullable();
		table.integer('port').defaultTo(5672);
		table.string('queue', 255).notNullable();
		table.string('exchange', 255).nullable();
		table.string('username', 255).nullable();
		table.string('password', 255).nullable();
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
	await knex.schema.dropTableIfExists('broker_adapters');
}
