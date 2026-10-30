import { CustomError } from '../../../shared/errors/CustomError.js';

/**
 * Validates that the referenced FK rows exist in a single database round-trip.
 *
 * @param {import('knex').Knex} connection - A Knex instance (already connected).
 * @param {function(string): string} qualify - Returns the schema-qualified table name, e.g. "schema.clients".
 * @param {object} ids
 * @param {string|null|undefined} ids.clienteId
 * @param {string|null|undefined} ids.transicionId
 * @param {string|null|undefined} ids.responsableId
 * @param {string|null|undefined} ids.clasificacionId
 * @param {string|null|undefined} ids.grupoId
 * @returns {Promise<void>}
 * @throws {CustomError} statusCode 404 for the first missing FK (checked in declaration order).
 */
export async function ensureRelationshipsExist(
    connection,
    qualify,
    { clienteId, transicionId, responsableId, clasificacionId, grupoId } = {}
) {
    /** @type {Array<{table: string, id: string, alias: string, message: string}>} */
    const checks = [];

    if (clienteId != null) {
        checks.push({
            table: qualify('clients'),
            id: clienteId,
            alias: 'cliente',
            message: `Client with id ${clienteId} does not exist.`,
        });
    }
    if (transicionId != null) {
        checks.push({
            table: qualify('transiciones'),
            id: transicionId,
            alias: 'transicion',
            message: `Transition with id ${transicionId} does not exist.`,
        });
    }
    if (responsableId != null) {
        checks.push({
            table: qualify('usuarios'),
            id: responsableId,
            alias: 'responsable',
            message: `Responsible with id ${responsableId} does not exist.`,
        });
    }
    if (clasificacionId != null) {
        checks.push({
            table: qualify('clasificaciones'),
            id: clasificacionId,
            alias: 'clasificacion',
            message: `Clasification with id ${clasificacionId} does not exist.`,
        });
    }
    if (grupoId != null) {
        checks.push({
            table: qualify('grupos'),
            id: grupoId,
            alias: 'grupo',
            message: `Group with id ${grupoId} does not exist.`,
        });
    }

    if (checks.length === 0) {
        return;
    }

    const selectParts = checks.map((check) => `(SELECT 1 FROM ${check.table} WHERE id = ? LIMIT 1) AS ${check.alias}`);
    const bindings = checks.map((check) => check.id);

    const sql = `SELECT ${selectParts.join(', ')}`;

    const result = await connection.raw(sql, bindings);
    const row = (result.rows ?? result)[0] ?? {};

    for (const check of checks) {
        if (!row[check.alias]) {
            throw new CustomError(check.message, 404);
        }
    }
}
