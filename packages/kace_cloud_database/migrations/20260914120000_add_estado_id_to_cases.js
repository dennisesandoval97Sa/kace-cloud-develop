import { serviceName } from '../env-config.js';
import { viewCasosV5 } from '../views/view_casosV5.js';
import { viewCasesDetailsV8 } from '../views/view_cases_details_v8.js';

/**
 * Las dos vistas se destruyen y se vuelven a crear IDÉNTICAS (V5/V8, sin cambios de columnas):
 * no es trabajo perdido. `alterTable` con `table.foreign()` hace que SQLite —el motor de los
 * tests de migraciones— reconstruya la tabla `cases` entera, y esa reconstrucción falla si hay
 * vistas colgando de ella. En PostgreSQL el DROP es inocuo porque las vistas se recrean en la
 * misma transacción de la migración.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', (table) => {
        table.string('estado_id', 36).nullable();
        table.foreign('estado_id').references('id').inTable('estados');
        table.index(['estado_id'], 'idx_cases_estado_id');
    });

    await knex.raw(viewCasosV5('cases', 'clients'));
    await knex.raw(viewCasesDetailsV8('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', (table) => {
        table.dropForeign('estado_id');
        table.dropIndex(['estado_id'], 'idx_cases_estado_id');
        table.dropColumn('estado_id');
    });

    await knex.raw(viewCasosV5('cases', 'clients'));
    await knex.raw(viewCasesDetailsV8('cases', 'clients', 'aux_cases', serviceName));
}
