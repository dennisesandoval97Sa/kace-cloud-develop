/**
 * Base query of the case candidate finder: open cases only. Shared by the assignment tick and the
 * off-tick backlog recount so both count exactly the same universe.
 */
export const buildActiveCasesBaseQuery = (conn, table, qualify = (x) => x) =>
    conn(qualify(table)).select(`${table}.id`).whereNull(`${table}.fecha_resolucion`);
