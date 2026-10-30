import { serviceName } from '../env-config.js';
import { viewCasosV6 } from '../views/view_casosV6.js';
import { viewCasesDetailsV9 } from '../views/view_cases_details_v9.js';

const MOTIVO_BAJA_TARGET_LENGTH = 5000;
const MOTIVO_BAJA_PREVIOUS_LENGTH = 255;
const MOTIVO_BAJA_TABLES = ['cases', 'fake_cases'];

const isPostgres = (knex) => knex.client.config.client === 'pg';

const BLOCKING_DEPENDENT_VIEWS_SQL = `
SELECT DISTINCT n.nspname, v.relname
FROM pg_depend d
JOIN pg_rewrite r   ON r.oid = d.objid
JOIN pg_class v     ON v.oid = r.ev_class
JOIN pg_namespace n ON n.oid = v.relnamespace
JOIN pg_class src   ON src.oid = d.refobjid
JOIN pg_namespace sn ON sn.oid = src.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = src.oid AND a.attnum = d.refobjsubid
WHERE v.oid <> src.oid
  AND n.nspname = current_schema()
  AND sn.nspname = current_schema()
  AND v.relname NOT IN ('view_casos', 'view_case_details')
  AND (
        (src.relname IN ('cases', 'fake_cases') AND a.attname = 'motivo_baja')
     OR  src.relname IN ('view_casos', 'view_case_details')
  )
`;

/**
 * PostgreSQL no permite ALTER TYPE de una columna usada por una vista
 * (`cannot alter type of a column used by a view or rule`). Las vistas
 * versionadas se recrean idénticas (V6 / V9). Otras vistas del tenant que
 * dependan de motivo_baja, view_casos o view_case_details hacen fallar la
 * migración nombrándolas, sin CASCADE.
 *
 * @param { import("knex").Knex } knex
 * @param { number } length
 * @returns { Promise<void> }
 */
export async function dropDependentCaseViewsAndAlterMotivoBaja(knex, length) {
    await knex.schema.dropViewIfExists('view_casos');
    await knex.schema.dropViewIfExists('view_case_details');

    await knex.schema.alterTable('cases', function (table) {
        table.string('motivo_baja', length).alter();
    });
    await knex.schema.alterTable('fake_cases', function (table) {
        table.string('motivo_baja', length).alter();
    });
}

async function applyMigrationLockTimeout(knex) {
    if (!isPostgres(knex)) {
        return;
    }
    await knex.raw("SET LOCAL lock_timeout = '5s'");
}

async function assertNoBlockingDependentViews(knex) {
    if (!isPostgres(knex)) {
        return;
    }

    const { rows } = await knex.raw(BLOCKING_DEPENDENT_VIEWS_SQL);
    if (rows.length === 0) {
        return;
    }

    const names = rows.map((row) => `${row.nspname}.${row.relname}`).join(', ');
    throw new Error(`Cannot alter motivo_baja: dependent views must be handled first: ${names}`);
}

async function assertMotivoBajaFitsPreviousLength(knex) {
    if (!isPostgres(knex)) {
        return;
    }

    for (const table of MOTIVO_BAJA_TABLES) {
        const { rows } = await knex.raw('SELECT count(*)::int AS n FROM ?? WHERE length(motivo_baja) > ?', [
            table,
            MOTIVO_BAJA_PREVIOUS_LENGTH,
        ]);
        if (rows[0].n > 0) {
            throw new Error(
                `${table}: ${rows[0].n} motivo_baja rows exceed ${MOTIVO_BAJA_PREVIOUS_LENGTH} chars; rollback would truncate them`
            );
        }
    }
}

async function recreateCurrentCaseViews(knex) {
    await knex.raw(viewCasosV6('cases', 'clients'));
    await knex.raw(viewCasesDetailsV9('cases', 'clients', 'aux_cases', serviceName));
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await applyMigrationLockTimeout(knex);
    await assertNoBlockingDependentViews(knex);
    await dropDependentCaseViewsAndAlterMotivoBaja(knex, MOTIVO_BAJA_TARGET_LENGTH);
    await recreateCurrentCaseViews(knex);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await applyMigrationLockTimeout(knex);
    await assertMotivoBajaFitsPreviousLength(knex);
    await assertNoBlockingDependentViews(knex);
    await dropDependentCaseViewsAndAlterMotivoBaja(knex, MOTIVO_BAJA_PREVIOUS_LENGTH);
    await recreateCurrentCaseViews(knex);
}
