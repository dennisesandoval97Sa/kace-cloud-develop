import { Cron } from 'croner';
import { Helper } from '@kace/core/src/shared/index.js';

export class Scheduler {
    #tick;
    #cronExpression;
    #runners;
    #task;
    #running = false;
    #shuttingDown = false;
    #inFlight = null;

    /**
     * @param {{
     *   tick: () => Promise<void>,
     *   cronExpression: string,
     *   runners?: Array<{ beginShutdown: () => void, inFlight: Promise<void> | null }>
     * }} params
     */
    constructor({ tick, cronExpression, runners = [] }) {
        if (typeof tick !== 'function') {
            throw new Error('tick must be a function');
        }
        if (typeof cronExpression !== 'string') {
            throw new Error('cronExpression must be a string');
        }
        this.#tick = tick;
        this.#cronExpression = cronExpression;
        this.#runners = runners;
    }

    start() {
        if (this.#running) return;
        this.#task = new Cron(this.#cronExpression, () => this.runTickNow());
        this.#running = true;
    }

    async stop() {
        if (this.#task) {
            this.#task.stop();
            this.#task = null;
        }
        this.#running = false;
    }

    beginShutdown() {
        this.#shuttingDown = true;
        for (const runner of this.#runners) {
            try {
                runner.beginShutdown();
            } catch (error) {
                Helper.logError('Scheduler.beginShutdown.runner.failed', {
                    err: error?.message,
                    errorName: error?.name,
                });
            }
        }
    }

    isHealthy() {
        return this.#running && !this.#shuttingDown;
    }

    /**
     * Runs the tick now if not shutting down and not already in flight.
     * `#inFlight` covers only the orchestration step (fetch context + dispatch);
     * per-job overlap protection lives in each `JobRunner`.
     * Errors from `tick` are logged and swallowed so the scheduler keeps running.
     * @returns {Promise<void>}
     */
    async runTickNow() {
        if (this.#shuttingDown) return;
        if (this.#inFlight) return;

        this.#inFlight = (async () => {
            const startedAt = Date.now();
            try {
                Helper.logDebug('tick.start', {});
                await this.#tick();
                Helper.logDebug('tick.dispatched', { durationMs: Date.now() - startedAt });
            } catch (error) {
                Helper.logError('tick.error', {
                    err: error?.message,
                    stack: error?.stack,
                    errorName: error?.name,
                });
            } finally {
                this.#inFlight = null;
            }
        })();
    }

    /**
     * Waits for the orchestration `#inFlight` and every runner's `inFlight`.
     * @param {number} [timeoutMs=1800000] Maximum time to wait (default 30 min).
     */
    async drain(timeoutMs = 30 * 60 * 1000) {
        const pending = [];
        if (this.#inFlight) pending.push(this.#inFlight);
        for (const runner of this.#runners) {
            if (runner.inFlight) pending.push(runner.inFlight);
        }
        if (pending.length === 0) return;
        const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
        await Promise.race([Promise.allSettled(pending), timeout]);
    }
}
