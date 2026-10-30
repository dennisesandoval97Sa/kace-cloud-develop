/**
 * Convierte un valor de formulario a entero, cayendo al fallback cuando no hay dato utilizable.
 *
 * Los inputs numericos entregan strings (y "" al limpiarse), asi que la conversion se necesita
 * tanto al normalizar la respuesta de la API para el formulario como al armar el payload de envio.
 * Solo se aceptan enteros: los decimales ya los rechaza el schema Joi del formulario antes del submit.
 *
 * @param {string|number|null|undefined} value Valor crudo del formulario o de la API
 * @param {*} fallback Valor a devolver cuando no hay entero valido
 * @returns {number|*} El entero convertido o el fallback
 */
export const toOptionalInt = (value, fallback) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    const parsed = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isInteger(parsed) ? parsed : fallback;
};
