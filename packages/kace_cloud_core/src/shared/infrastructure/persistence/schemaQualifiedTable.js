/**
 * Returns a table name qualified with the tenant schema when one is configured.
 *
 * @param {string|null} schema
 * @param {string} table
 * @returns {string}
 */
export const schemaQualifiedTable = (schema, table) => (schema ? `${schema}.${table}` : table);
