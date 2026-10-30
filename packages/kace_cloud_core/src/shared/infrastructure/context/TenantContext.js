import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tenant Context Manager using AsyncLocalStorage
 *
 * Provides request-scoped tenant context that is:
 * - Thread-safe (no race conditions in Lambda concurrency)
 * - Auto-cleaned (garbage collected when request ends)
 * - Testable (isolated per async execution)
 *
 * @example
 * // Set tenant (in middleware)
 * TenantContext.run(tenant, async () => {
 *   await handler(event);
 * });
 *
 * // Get tenant (anywhere in the call stack)
 * const tenant = TenantContext.getTenant();
 * const dbHost = tenant.db_host.value;
 */
class TenantContextManager {
    static #storage = new AsyncLocalStorage();

    /**
     * Run a function with tenant context
     *
     * @param {Tenant} tenant - Tenant entity
     * @param {Function} fn - Function to run with tenant context
     * @returns {Promise<*>} Result of the function
     *
     * @example
     * await TenantContext.run(tenant, async () => {
     *   const result = await someOperation();
     *   return result;
     * });
     */
    static run(tenant, fn) {
        return this.#storage.run(
            {
                tenant,
                tenantId: tenant.id.value,
                startTime: Date.now(),
            },
            fn
        );
    }

    /**
     * Run a function with tenant context plus an explicit `service` label.
     *
     * Used by long-running workers that process many (tenant, job) pairs in the
     * same Node process: the worker assigns a per-execution service string
     * (e.g. `JobName-<uuid>`) so log entries can be filtered as a single trace.
     * Lambdas keep using `run()` and fall back to `AWS_LAMBDA_FUNCTION_NAME`.
     *
     * @param {Tenant} tenant
     * @param {{service: string}} options
     * @param {Function} fn
     * @returns {Promise<*>}
     */
    static runForJob(tenant, { service }, fn) {
        return this.#storage.run(
            {
                tenant,
                tenantId: tenant.id.value,
                startTime: Date.now(),
                service,
            },
            fn
        );
    }

    /**
     * Get the service label set for the current execution context, if any.
     *
     * @returns {string|null}
     */
    static getService() {
        const store = this.#storage.getStore();
        return store?.service || null;
    }

    /**
     * Get current tenant from context
     *
     * @returns {Tenant|null} Current tenant or null if not in tenant context
     *
     * @example
     * const tenant = TenantContext.getTenant();
     * if (tenant) {
     *   const s3Bucket = tenant.aws_s3_bucket.value;
     * }
     */
    static getTenant() {
        const store = this.#storage.getStore();
        return store?.tenant || null;
    }

    /**
     * Get current tenant ID from context
     *
     * @returns {string|null} Current tenant ID or null
     *
     * @example
     * const tenantId = TenantContext.getTenantId();
     * console.log(`Processing for tenant: ${tenantId}`);
     */
    static getTenantId() {
        const store = this.#storage.getStore();
        return store?.tenantId || null;
    }

    /**
     * Get tenant configuration value safely
     *
     * @param {string} path - Dot-notation path to value (e.g., 'aws_s3_bucket.value')
     * @returns {*} Configuration value or null
     *
     * @example
     * const s3Bucket = TenantContext.getConfig('aws_s3_bucket.value');
     * const dbHost = TenantContext.getConfig('db_host.value');
     */
    static getConfig(path) {
        const tenant = this.getTenant();
        if (!tenant) return null;

        const parts = path.split('.');
        let value = tenant;

        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }

        return value;
    }

    /**
     * Check if running in tenant context
     *
     * @returns {boolean} True if in tenant context
     *
     * @example
     * if (TenantContext.isInContext()) {
     *   const tenant = TenantContext.getTenant();
     * }
     */
    static isInContext() {
        return this.#storage.getStore() !== undefined;
    }

    /**
     * Get request start time
     *
     * @returns {number|null} Timestamp when context was created
     */
    static getStartTime() {
        const store = this.#storage.getStore();
        return store?.startTime || null;
    }

    /**
     * Get elapsed time since context creation
     *
     * @returns {number|null} Elapsed time in milliseconds
     */
    static getElapsedTime() {
        const startTime = this.getStartTime();
        return startTime ? Date.now() - startTime : null;
    }

    static buildKnexConfig() {
        const tenant = this.getTenant();
        return tenant.buildKnexConfig();
    }
}

export { TenantContextManager as TenantContext };
