/**
 * Helper para obtener el nombre de la columna con o sin prefijo 'casos.'
 * @param {string} column - El nombre base de la columna.
 * @param {boolean} isCustomViewEnabled - Si es true, no agrega el prefijo 'casos.'
 * @returns {string}
 */
const columnName = (column, isCustomViewEnabled) => isCustomViewEnabled ? column : `cases.${column}`;

/**
 * Genera los filtros para casos abiertos de un cliente.
 *
 * @param {string|number} clientId - ID del cliente.
 * @param {boolean} [isCustomViewEnabled=false] - Si es true, omite el prefijo 'casos.' en las columnas.
 * @returns {Array<Object>}
 */
export const getOpenCasesParams = (clientId, isCustomViewEnabled = false) => [
    {
        column: columnName("cliente_id", isCustomViewEnabled),
        value: clientId,
        type: "AND",
        operator: "eq",
    },
    {
        column: columnName("fecha_resolucion", isCustomViewEnabled),
        value: "null",
        type: "AND",
        operator: "null",
    },
    {
        column: columnName("parent_id", isCustomViewEnabled),
        value: "null",
        type: "AND",
        operator: "null",
    },
];

/**
 * Genera los filtros para casos cerrados de un cliente.
 *
 * @param {string|number} clientId - ID del cliente.
 * @param {boolean} [isCustomViewEnabled=false] - Si es true, omite el prefijo 'casos.' en las columnas.
 * @returns {Array<Object>}
 */
export const getClosedCasesParams = (clientId, isCustomViewEnabled = false) => [
    {
        column: columnName("cliente_id", isCustomViewEnabled),
        value: clientId,
        type: "AND",
        operator: "eq",
    },
    {
        column: columnName("fecha_resolucion", isCustomViewEnabled),
        value: "null",
        type: "AND",
        operator: "notNull",
    },
];
