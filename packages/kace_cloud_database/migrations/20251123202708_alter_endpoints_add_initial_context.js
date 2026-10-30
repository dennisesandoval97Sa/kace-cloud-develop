/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
	return knex.schema.alterTable('ws_rest_endpoints', function (table) {
		table.jsonb('initial_context').nullable();
	});
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
	return knex.schema.alterTable('ws_rest_endpoints', function (table) {
		table.dropColumn('initial_context');
	});
}
