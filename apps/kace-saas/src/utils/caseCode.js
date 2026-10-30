/**
 * Codigo visible de un caso: `external_code`, o `folio` como respaldo cuando el
 * caso no tiene codigo externo. Ambos pueden ser nulos.
 *
 * @param {object} kase caso devuelto por la API
 * @returns {string} codigo del caso, o cadena vacia si no tiene ninguno
 */
export const getCaseCode = (kase) => kase?.external_code || kase?.folio || "";

/**
 * Sufijo " - {codigo}" listo para concatenar al numero del caso.
 *
 * @param {object} kase caso devuelto por la API
 * @returns {string} sufijo con el codigo, o cadena vacia si no tiene ninguno
 */
export const getCaseCodeSuffix = (kase) => {
    const code = getCaseCode(kase);
    return code ? ` - ${code}` : "";
};
