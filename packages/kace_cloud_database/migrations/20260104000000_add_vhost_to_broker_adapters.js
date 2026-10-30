/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
	await knex.schema.alterTable('broker_adapters', (table) => {
		table.string('vhost', 255).nullable();
	});
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
	await knex.schema.alterTable('broker_adapters', (table) => {
		table.dropColumn('vhost');
	});
}
