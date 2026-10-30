import pLimit from 'p-limit';
import {
    DEFAULT_ID_CHUNK_SIZE,
    DEFAULT_ID_MAX_CONCURRENCY,
    chunkedFanOut,
} from '../../../shared/infrastructure/utils/ChunkedFanOut.js';

// Smaller IN-lists keep the query planner from falling back to seq-scan on large tables like
// aux_cases, and reduce single-query memory per chunk; the shared pLimit below keeps total
// concurrency flat regardless of chunk count.
const DEFAULT_CHUNK_SIZE = DEFAULT_ID_CHUNK_SIZE;
// Cap on simultaneous DB queries issued by a single load(). load() fans out into 5 entity
// branches, each chunked at DEFAULT_CHUNK_SIZE, so a large tenant can otherwise demand dozens
// of connections at once and exhaust the (per-tenant) Knex pool — the acquires queue locally
// and time out before reaching the DB/RDS Proxy. Keep this <= the job's poolMax with headroom
// for the executor's other queries.
const DEFAULT_MAX_CONCURRENCY = DEFAULT_ID_MAX_CONCURRENCY;

export class CaseContextBatchLoader {
    /**
     * @param {{ read: { table: (name: string) => import('knex').Knex.QueryBuilder },
     *           qualifiedName: (name: string) => string }} caseRepository
     * @param {{ chunkSize?: number, maxConcurrency?: number }} [opts]
     */
    constructor(caseRepository, opts = {}) {
        // Reach through the repository on every query so reads resolve via this.read lazily,
        // honoring read-after-write: a write earlier in the request/job reverts subsequent
        // reads to the writer (read-write-split.md §4.6, §5).
        this._caseRepository = caseRepository;
        this._readTable = (name) => this._caseRepository.read.table(name);
        this._qualifiedName = (name) => this._caseRepository.qualifiedName(name);
        this.chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
        this.maxConcurrency = opts.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
        // Shared across all branches/chunks of a load() so total in-flight queries stay bounded.
        this._limit = pLimit(this.maxConcurrency);
    }

    /**
     * @param {Array<Object>} cases
     * @param {{ auxCaseKeys?: Set<string>|null }} [opts] - auxCaseKeys: top-level aux_cases.data
     *   sub-keys actually consumed by the batch (see AuxCaseKeyCollector). A Set projects only
     *   those keys in the aux_cases query; null/omitted fetches the full `data` blob.
     */
    async load(cases, opts = {}) {
        const auxCaseKeys = opts.auxCaseKeys ?? null;
        const caseIds = [...new Set(cases.map((c) => c.id.value))];
        const clienteIds = [...new Set(cases.map((c) => c.cliente_id?.value).filter(Boolean))];
        const clasificacionIds = [...new Set(cases.map((c) => c.clasificacion_id?.value).filter(Boolean))];
        const transicionIds = [...new Set(cases.map((c) => c.transicion_id?.value).filter(Boolean))];

        const [auxCasesByCaseId, clientsRows, auxClientsRows, clasificacionesRows, estadosRows] = await Promise.all([
            this.#loadAuxCases(caseIds, auxCaseKeys),
            this.#chunkedWhereIn('clients', 'id', clienteIds, ['*']),
            this.#chunkedWhereIn('aux_clients', 'cliente_id', clienteIds, ['cliente_id', 'data']),
            this.#chunkedWhereIn('clasificaciones', 'id', clasificacionIds, ['*']),
            this.#loadEstadosByTransicion(transicionIds),
        ]);

        const clientsById = new Map(clientsRows.map((r) => [r.id, r]));
        const auxClientsByClienteId = new Map(auxClientsRows.map((r) => [r.cliente_id, this.#parseJson(r.data)]));
        const clasificacionesById = new Map(clasificacionesRows.map((r) => [r.id, this.#enrichClasificacion(r)]));
        const estadosByTransicionId = new Map(
            estadosRows.map((r) => [r.transicion_id, { id: r.id, nombre: r.nombre }])
        );

        const map = new Map();
        for (const kase of cases) {
            const id = kase.id.value;
            map.set(id, {
                cases: kase.toJson(),
                clients: clientsById.get(kase.cliente_id?.value) ?? null,
                aux_cases: auxCasesByCaseId.get(id),
                aux_clients: auxClientsByClienteId.get(kase.cliente_id?.value),
                clasificaciones: clasificacionesById.get(kase.clasificacion_id?.value) ?? null,
                estados: estadosByTransicionId.get(kase.transicion_id?.value) ?? { id: undefined, nombre: undefined },
            });
        }
        return map;
    }

    async #chunkedWhereIn(table, column, ids, select) {
        return chunkedFanOut(
            ids,
            (chunk) =>
                this._readTable(table)
                    .whereIn(column, chunk)
                    .select(...select),
            { chunkSize: this.chunkSize, limit: this._limit }
        );
    }

    async #loadAuxCases(caseIds, auxCaseKeys) {
        // auxCaseKeys === null  => cannot determine consumed keys safely => fetch full `data`.
        // auxCaseKeys is a Set  => project only those top-level sub-keys (avoids JSONB detoast of the rest).
        // A projected 'caso_id' key would alias-collide with the caso_id key column in the select
        // (`caso_id, data->'caso_id' as "caso_id"`): drivers resolve duplicates last-wins, so the
        // result Map would be keyed by the JSONB value and every case would silently lose its aux
        // context. Similarly, if a key k is in the set and k__exists is also in the set, the
        // existence alias of k (`k__exists`) collides with the value column of `k__exists`,
        // causing silent last-wins corruption. Fall back to the full-data query in both cases.
        if (
            auxCaseKeys === null ||
            auxCaseKeys.has('caso_id') ||
            [...auxCaseKeys].some((k) => auxCaseKeys.has(`${k}__exists`))
        ) {
            const rows = await this.#chunkedWhereIn('aux_cases', 'caso_id', caseIds, ['caso_id', 'data']);
            return new Map(rows.map((r) => [r.caso_id, this.#parseJson(r.data)]));
        }

        if (auxCaseKeys.size === 0) {
            // caso_id-only query (not a skip): preserves the {}-vs-undefined row-existence distinction.
            const rows = await this.#chunkedWhereIn('aux_cases', 'caso_id', caseIds, ['caso_id']);
            return new Map(rows.map((r) => [r.caso_id, {}]));
        }

        const keys = [...auxCaseKeys];
        // Derive dialect and raw() from the same lazily-resolved read connection the queries
        // use (the read facade's builders carry their client), so we never touch the writer.
        const client = this._readTable('aux_cases').client;
        const select = ['caso_id'];
        for (const key of keys) {
            // Alongside each value expr, project a per-key existence column: the value expr alone
            // cannot distinguish a JSON null value from an absent key (both arrive as JS null),
            // and full-data mode preserves that difference (null vs key-absent), which
            // RuleValidator observes (undefined short-circuits negative operators; null doesn't).
            const existsAlias = `${key}__exists`;
            select.push(client.raw('data->? as ??', [key, key]));
            // jsonb_exists(data, key) is the function form of the jsonb `?` operator, which
            // would otherwise collide with knex's positional bindings.
            select.push(client.raw('jsonb_exists(data, ?) as ??', [key, existsAlias]));
        }

        const rows = await this.#chunkedWhereIn('aux_cases', 'caso_id', caseIds, select);
        const result = new Map();
        for (const row of rows) {
            const aux = {};
            for (const key of keys) {
                // Absent key => stays absent in aux (never leak the __exists column itself).
                if (!row[`${key}__exists`]) continue;
                const raw = row[key];
                if (raw === null || raw === undefined) {
                    // Key exists with a JSON null value: full-data mode yields null, not
                    // key-absent — preserve that for RuleValidator's negative operators.
                    aux[key] = null;
                    continue;
                }
                // pg materializes `data->'key'` jsonb itself: objects/arrays arrive as
                // objects and JSON string scalars as JS strings. Re-parsing would coerce
                // '123' into the number 123 (and 'true' into a boolean), diverging from
                // full-data mode — use the driver value as-is.
                aux[key] = raw;
            }
            result.set(row.caso_id, aux);
        }
        return result;
    }

    // TODO(MSKT-1392): deriva el estado en vivo desde transiciones.siguiente_estado_id en vez de
    // leer la columna persistida cases.estado_id — mismo TODO que KnexEventRepository.
    async #loadEstadosByTransicion(ids) {
        return chunkedFanOut(
            ids,
            (chunk) =>
                this._readTable('transiciones')
                    .leftJoin(this._qualifiedName('estados'), 'transiciones.siguiente_estado_id', 'estados.id')
                    .whereIn('transiciones.id', chunk)
                    .select('transiciones.id as transicion_id', 'estados.id', 'estados.nombre'),
            { chunkSize: this.chunkSize, limit: this._limit }
        );
    }

    #parseJson(value) {
        if (value === null || value === undefined) return undefined;
        if (typeof value === 'object') return value;
        try {
            return JSON.parse(value);
        } catch {
            return undefined;
        }
    }

    #enrichClasificacion(row) {
        const parts = Array.from({ length: 10 }, (_, i) => row[`nivel${i + 1}`]).filter(Boolean);
        return { ...row, description: parts.join(' -> ') };
    }
}
