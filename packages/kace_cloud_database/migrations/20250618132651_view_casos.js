import { viewCases } from '../views/view_cases.js';

export async function up(knex) {
    await knex.raw(viewCases('casos', 'clientes'));
}

export async function down(knex) {
    await knex.raw(`DROP VIEW IF EXISTS view_casos`);
}
