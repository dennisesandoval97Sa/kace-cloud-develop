/**
 * Postgres exige que las filas padre referenciadas por una clave foranea
 * existan de verdad; sqlite nunca lo exigio, asi que las factorias `*Mother`
 * llevan años insertando ids inventados (`uuidv4()`) que nunca respaldaban
 * con una fila. Este helper es el punto comun para dejar de hacerlo: crea la
 * fila padre minima (solo `id`, unico campo obligatorio en las tablas de
 * catalogo que consumen las Mother) de forma idempotente.
 *
 * `onConflict('id').ignore()` lo vuelve seguro de llamar mas de una vez con
 * el mismo id -por ejemplo al reutilizar una fila de los seeds- sin
 * reventar por violacion de la clave primaria.
 *
 * @param {import('knex').Knex} connection - Conexion knex del archivo de test (`repository.connection`).
 * @param {string} table - Tabla padre a garantizar (p. ej. `'clients'`, `'usuarios'`).
 * @param {string|null|undefined} id - Id a garantizar. Si es nulo/indefinido, no hace nada.
 * @param {Object} [extra] - Columnas adicionales a fijar en el insert, si la tabla las requiere.
 * @returns {Promise<void>}
 */
export const ensureParentRow = async (connection, table, id, extra = {}) => {
    if (!id) {
        return;
    }

    await connection(table)
        .insert({ id, ...extra })
        .onConflict('id')
        .ignore();
};

/**
 * Aplica `ensureParentRow` a varias filas en paralelo. Pensado para los
 * metodos `create*` de las Mother, que suelen depender de varias tablas
 * padre a la vez (p. ej. `casos` depende de `clients`, `usuarios`,
 * `clasificaciones`, `descripciones_casos`, `grupos` y `transiciones`).
 *
 * @param {import('knex').Knex} connection
 * @param {Array<{table: string, id: string|null|undefined, extra?: Object}>} rows
 * @returns {Promise<void>}
 */
export const ensureParentRows = async (connection, rows) =>
    Promise.all(rows.map(({ table, id, extra }) => ensureParentRow(connection, table, id, extra)));
