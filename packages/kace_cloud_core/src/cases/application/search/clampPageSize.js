export const MAX_PAGE_SIZE = 100;

/**
 * Normaliza y limita el tamaño de página para el listado/search de casos.
 *
 * El backend NUNCA debe devolver resultados ilimitados: si el cliente omite el
 * limit, envía null/0/negativo, un valor no numérico, o un valor mayor al máximo,
 * se aplica MAX_PAGE_SIZE. Es el único punto de la política de tope.
 *
 * @param {number|null|undefined} limit
 * @param {number} [max=MAX_PAGE_SIZE]
 * @returns {number} entero en el rango [1, max]
 */
export function clampPageSize(limit, max = MAX_PAGE_SIZE) {
    const parsed = Math.floor(Number(limit));

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return max;
    }

    return Math.min(parsed, max);
}
