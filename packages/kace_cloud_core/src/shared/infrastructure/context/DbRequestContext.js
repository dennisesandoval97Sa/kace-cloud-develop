import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request/job-scoped DB write flag for auto read-after-write consistency.
 *
 * Lambda: one run() per invocation (wired in withTenantContext). ECS workers are
 * INTENDED to wrap each job in runForJob() so the flag resets per job and never
 * persists in the long-lived process; that worker wiring is pending and tracked
 * separately. Until then, markWrite()/hasWritten() are no-ops in the worker (safe:
 * worker repos do not use this.reader yet).
 *
 * Outside any run, hasWritten() returns false (fail-open: reads only divert
 * to the writer when preferReplica is true, so "false outside context" is safe).
 */
class DbRequestContext {
    static #storage = new AsyncLocalStorage();

    /**
     * @param {Function} fn
     * @returns {Promise<*>}
     */
    static run(fn) {
        return this.#storage.run({ written: false }, fn);
    }

    /**
     * Alias used by long-running workers to make per-job scoping explicit.
     * @param {Function} fn
     * @returns {Promise<*>}
     */
    static runForJob(fn) {
        return this.#storage.run({ written: false }, fn);
    }

    static markWrite() {
        const store = this.#storage.getStore();
        if (store) {
            store.written = true;
        }
    }

    /**
     * @returns {boolean}
     */
    static hasWritten() {
        const store = this.#storage.getStore();
        return store ? store.written === true : false;
    }
}

export { DbRequestContext };
