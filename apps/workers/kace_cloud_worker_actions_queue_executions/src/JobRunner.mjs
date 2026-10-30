import pLimit from 'p-limit';
import { Helper, TenantContext, ValueObjectUuid } from '@kace/core/src/shared/index.js';

export class JobRunner {
    #job;
    #concurrency;
    #limit;
    #inFlight = null;
    #shuttingDown = false;

    /**
     * @param {{job: {name: string, run: (tenant) => Promise<any>}, concurrency: number}} params
     */
    constructor({ job, concurrency }) {
        if (!job || typeof job.run !== 'function' || typeof job.name !== 'string') {
            throw new Error('job must expose {name: string, run: function}');
        }
        if (!Number.isInteger(concurrency) || concurrency <= 0) {
            throw new Error(`concurrency must be a positive integer (received ${concurrency})`);
        }
        this.#job = job;
        this.#concurrency = concurrency;
        this.#limit = pLimit(concurrency);
    }

    get name() {
        return this.#job.name;
    }

    get inFlight() {
        return this.#inFlight;
    }

    beginShutdown() {
        this.#shuttingDown = true;
    }

    /**
     * Fire-and-forget. Never throws. Returns undefined synchronously; the actual
     * work runs asynchronously and is tracked via `inFlight`.
     * @param {{tenants: Array}} params
     */
    runIfIdle({ tenants }) {
        if (this.#shuttingDown) return;
        if (this.#inFlight) {
            Helper.logInfo('runner.skip', { job: this.#job.name });
            return;
        }
        const startedAt = Date.now();
        Helper.logDebug('runner.start', {
            job: this.#job.name,
            tenants: tenants.length,
            concurrency: this.#concurrency,
        });

        this.#inFlight = (async () => {
            const counters = { processed: 0, errors: 0 };
            const tasks = tenants.map((tenant) =>
                this.#limit(async () => {
                    const executionId = ValueObjectUuid.random();
                    const service = `${this.#job.name}-${executionId}`;
                    await TenantContext.runForJob(tenant, { service }, async () => {
                        try {
                            await this.#job.run(tenant);
                            counters.processed += 1;
                        } catch (error) {
                            counters.errors += 1;
                            Helper.logError('runner.tenant.error', {
                                job: this.#job.name,
                                tenantId: tenant.id?.value,
                                executionId,
                                err: error?.message,
                                stack: error?.stack,
                                errorName: error?.name,
                            });
                        }
                    });
                })
            );
            try {
                await Promise.all(tasks);
            } finally {
                const payload = {
                    job: this.#job.name,
                    durationMs: Date.now() - startedAt,
                    tenantsProcessed: counters.processed,
                    errors: counters.errors,
                };
                if (counters.processed > 0 || counters.errors > 0) {
                    Helper.logInfo('runner.end', payload);
                } else {
                    Helper.logDebug('runner.end', payload);
                }
                this.#inFlight = null;
            }
        })();
    }
}
