/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
	await knex.schema.createTable('broker_message_mapper_rules', (table) => {
		table.string('id', 36).primary();
		table.string('mapper_id', 36).notNullable();
		table.string('target_entity', 255).notNullable();
		table.string('target_field', 255).notNullable();
		table.string('source_field', 1024).notNullable();
		table.timestamp('created_at').defaultTo(knex.fn.now());
		table.string('created_by', 36).nullable();
		table.timestamp('updated_at').nullable();
		table.string('updated_by', 36).nullable();
		table.timestamp('deleted_at').nullable();
		table.string('deleted_by', 36).nullable();

		if (knex.client.config.client !== 'sqlite3') {
			table.foreign('mapper_id').references('id').inTable('broker_message_mappers');
		}
	});
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
	await knex.schema.dropTableIfExists('broker_message_mapper_rules');
}
