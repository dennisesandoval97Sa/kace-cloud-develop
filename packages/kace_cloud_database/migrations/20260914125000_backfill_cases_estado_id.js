/**
 * Filas por sentencia. `cases` es de las tablas grandes del sistema, así que el relleno se
 * parte en lotes en vez de hacerse en un solo UPDATE: cada sentencia toma y suelta los
 * bloqueos de su lote, y el despliegue no queda detrás de una escritura sobre la tabla
 * entera. El tamaño es el habitual para lotes de mantenimiento: suficientemente grande para
 * que el viaje de ida y vuelta no domine, suficientemente pequeño para no bloquear largo.
 */
const BATCH_SIZE = 5000;

const backfillBatchSql = (idCount) => `
    UPDATE cases
    SET estado_id = (
        SELECT transiciones.siguiente_estado_id
        FROM transiciones
        WHERE transiciones.id = cases.transicion_id
    )
    WHERE cases.transicion_id IS NOT NULL
      AND cases.estado_id IS NULL
      AND cases.id IN (${Array.from({ length: idCount }, () => '?').join(', ')})
`;

/**
 * Ids del siguiente lote, avanzando por `id` y no por OFFSET.
 *
 * El cursor es lo que garantiza que el bucle TERMINE: un caso cuya transición no tiene
 * siguiente estado se queda con `estado_id` NULL aunque el UPDATE lo toque, así que un
 * criterio basado solo en `estado_id IS NULL` volvería a seleccionarlo lote tras lote.
 * Avanzar por `id` lo deja atrás igualmente.
 */
const nextBatchIds = async (knex, afterId, batchSize) => {
    const rows = await knex('cases')
        .select('id')
        .whereNotNull('transicion_id')
        .whereNull('estado_id')
        .where('id', '>', afterId)
        .orderBy('id')
        .limit(batchSize);

    return rows.map((row) => row.id);
};

/**
 * Rellena `cases.estado_id` únicamente donde todavía es NULL.
 *
 * La guarda `estado_id IS NULL` no es una optimización, es lo que hace la operación segura
 * de reejecutar: el checklist post-deploy contempla volver a correrla para capturar lo
 * escrito durante la ventana de despliegue, y sin la guarda esa reejecución sobreescribiría
 * con el estado derivado de la transición cualquier `estado_id` que el dominio haya escrito.
 *
 * Se expresa con subconsulta correlacionada y no con `UPDATE ... FROM` para que funcione
 * igual en PostgreSQL y en SQLite (el motor con el que corren los tests de migraciones).
 *
 * @param { import('knex').Knex } knex
 * @param {{ batchSize?: number }} [options] - `batchSize` solo lo baja el test, para ejercitar
 *   el recorrido por lotes sin sembrar decenas de miles de filas.
 * @returns { Promise<number>} Filas seleccionadas para relleno, para trazar el avance.
 */
export async function backfillEstadoId(knex, { batchSize = BATCH_SIZE } = {}) {
    let afterId = '';
    let processed = 0;

    for (;;) {
        const ids = await nextBatchIds(knex, afterId, batchSize);
        if (ids.length === 0) {
            return processed;
        }

        await knex.raw(backfillBatchSql(ids.length), ids);

        afterId = ids[ids.length - 1];
        processed += ids.length;
    }
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await backfillEstadoId(knex);
}

/**
 * No-op deliberado: el rollback de `20260914120000_add_estado_id_to_cases.js` —que corre
 * inmediatamente después de éste— elimina la columna entera, así que vaciarla aquí sería
 * trabajo perdido sobre la tabla completa.
 *
 * @returns { Promise<void> }
 */
export async function down() {}
