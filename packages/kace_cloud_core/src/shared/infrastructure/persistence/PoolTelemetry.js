import { Helper } from '../utils/Helper.js';

/**
 * Lightweight, low-volume instrumentation for a Knex connection pool (tarn).
 *
 * Attaches listeners to the underlying tarn pool and emits a SINGLE structured
 * `pool.summary` log line when torn down (typically right before `db.destroy()`).
 * This answers "how many physical connections did this run try to open, and did
 * any acquire time out?" without flooding CloudWatch with one line per event.
 *
 * Event semantics (tarn):
 *  - `createRequest`  → a NEW physical connection is being opened  ⇒ createsAttempted
 *  - `createFail`     → that physical open failed                  ⇒ createsFailed
 *  - `acquireRequest` → a borrow from the pool was requested (sampled for peaks)
 *  - `acquireFail`    → a borrow timed out (the KnexTimeoutError)  ⇒ acquireFails
 */
export class PoolTelemetry {
    /**
     * @param {import('knex').Knex} db   The knex instance returned by `knex(config)`.
     * @param {Object} [context]         Extra fields to include in the summary log
     *                                   (e.g. `{ job, tenantId }`).
     * @returns {() => void}             Teardown function that detaches the listeners
     *                                   and emits the `pool.summary` line. Safe to call
     *                                   even if the pool was never created.
     */
    static attach(db, context = {}) {
        const pool = db?.client?.pool;
        if (!pool || typeof pool.on !== 'function') {
            return () => {};
        }

        const counters = {
            createsAttempted: 0,
            createsFailed: 0,
            acquireFails: 0,
            peakUsed: 0,
            peakPendingAcquires: 0,
        };

        const onCreateRequest = () => {
            counters.createsAttempted += 1;
        };
        const onCreateFail = () => {
            counters.createsFailed += 1;
        };
        const onAcquireRequest = () => {
            const used = pool.numUsed();
            const pendingAcquires = pool.numPendingAcquires();
            if (used > counters.peakUsed) {
                counters.peakUsed = used;
            }
            if (pendingAcquires > counters.peakPendingAcquires) {
                counters.peakPendingAcquires = pendingAcquires;
            }
        };
        const onAcquireFail = () => {
            counters.acquireFails += 1;
        };

        pool.on('createRequest', onCreateRequest);
        pool.on('createFail', onCreateFail);
        pool.on('acquireRequest', onAcquireRequest);
        pool.on('acquireFail', onAcquireFail);

        return () => {
            try {
                pool.removeListener('createRequest', onCreateRequest);
                pool.removeListener('createFail', onCreateFail);
                pool.removeListener('acquireRequest', onAcquireRequest);
                pool.removeListener('acquireFail', onAcquireFail);
            } catch {
                // The pool may already be destroyed; detaching is best-effort.
            }

            Helper.logDebug('pool.summary', {
                ...context,
                poolMax: pool.max,
                createsAttempted: counters.createsAttempted,
                createsFailed: counters.createsFailed,
                acquireFails: counters.acquireFails,
                peakUsed: counters.peakUsed,
                peakPendingAcquires: counters.peakPendingAcquires,
            });
        };
    }
}
