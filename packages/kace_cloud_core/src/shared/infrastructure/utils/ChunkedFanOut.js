import pLimit from 'p-limit';
import { Helper } from './Helper.js';

// Smaller IN-lists keep the query planner from falling back to seq-scan on large tables and
// bound bind-parameter counts (Postgres caps a single query's parameters); a shared pLimit
// across chunks (and, for callers that pass their own `limit`, across unrelated fan-outs too)
// keeps total concurrency flat regardless of chunk count.
export const DEFAULT_ID_CHUNK_SIZE = 1000;
export const DEFAULT_ID_MAX_CONCURRENCY = 4;

export function chunkIds(ids, chunkSize = DEFAULT_ID_CHUNK_SIZE) {
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
    return chunks;
}

/**
 * Splits `ids` into bounded chunks and runs `run(chunk)` for each, throttled by `limit`.
 * Pass a caller-owned `limit` (e.g. a single `pLimit` shared across several fan-out branches
 * of one logical load) to keep total in-flight queries bounded across all of them combined;
 * omitting it creates a fan-out-local gate.
 *
 * @param {Array<string>} ids
 * @param {(chunk: Array<string>) => Promise<Array<any>>} run
 * @param {{ chunkSize?: number, limit?: (fn: () => Promise<any>) => Promise<any> }} [opts]
 * @returns {Promise<Array<any>>} Flattened results across all chunks.
 */
export async function chunkedFanOut(ids, run, { chunkSize = DEFAULT_ID_CHUNK_SIZE, limit } = {}) {
    if (ids.length === 0) return [];
    const chunks = chunkIds(ids, chunkSize);
    Helper.logDebug('chunkedFanOut', {
        total_ids: ids.length,
        chunk_size: chunkSize,
        chunks_count: chunks.length,
    });
    const gate = limit ?? pLimit(DEFAULT_ID_MAX_CONCURRENCY);
    const results = await Promise.all(
        chunks.map((chunk, i) =>
            gate(async () => {
                Helper.logDebug(`chunkedFanOut chunk ${i + 1}/${chunks.length}`, { chunk_size: chunk.length });
                return run(chunk);
            })
        )
    );
    return results.flat();
}
