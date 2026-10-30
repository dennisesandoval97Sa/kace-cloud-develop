/**
 * Columns a board's primary entity must expose to support case bulk actions.
 * The real `cases` table always provides them; cases-like views must too.
 * @type {string[]}
 */
export const BULK_REQUIRED_COLUMNS = ['id', 'fecha_resolucion', 'transicion_id'];

/**
 * Whether a board primary entity behaves like the `cases` entity for bulk actions.
 * True for the real `cases` table, or for a board view (`boards_*`) whose name
 * contains `cases` or `casos` (case-insensitive).
 * @param {string|null|undefined} entity
 * @returns {boolean}
 */
export const isCasesLikeEntity = (entity) => {
    if (!entity) return false;
    if (entity === 'cases') return true;
    if (!entity.startsWith('boards_')) return false;
    const lower = entity.toLowerCase();
    return lower.includes('cases') || lower.includes('casos');
};
