import util from 'node:util';
import { TenantContext } from '../context/TenantContext.js';

const TENANT_DEBUG_CACHE_TTL_MS = 60_000;
const tenantDebugCache = new Map();
const activeTimers = new Map();
const forceShowLogsInTests = true;

function parseTenantDebugFlags(tenant) {
    const debugValue = tenant.apps_debug?.value;
    const enabled = debugValue === '1' || debugValue === 'true';
    const levelValue = tenant.apps_debug_level?.value;
    const level = Number(levelValue) || 1;
    return { enabled, level };
}

function readTenantDebugFlags() {
    const tenant = TenantContext.getTenant();
    if (!tenant) {
        return { enabled: false, level: 1 };
    }

    const tenantId = tenant.id?.value ?? null;
    if (tenantId === null) {
        return parseTenantDebugFlags(tenant);
    }

    const now = Date.now();
    const cached = tenantDebugCache.get(tenantId);
    if (cached && cached.expiresAt > now) {
        return { enabled: cached.enabled, level: cached.level };
    }

    const fresh = parseTenantDebugFlags(tenant);
    tenantDebugCache.set(tenantId, { ...fresh, expiresAt: now + TENANT_DEBUG_CACHE_TTL_MS });
    return fresh;
}

function parseBoolEnv(value) {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return null;
}

function parseLevelEnv(value) {
    if (value === '1' || value === '2') return Number(value);
    return null;
}

/**
 * Resolves the effective debug-enabled state for the current log call.
 *
 * Resolution chain (higher wins):
 *   1. process.env.APPS_DEBUG  — official deploy-time toggle for apiv1 lambdas
 *   2. process.env.APPS_DEBUG_OVERRIDE — deprecated alias kept for backwards
 *      compatibility with the actions-queue-executions worker
 *      (apps/workers/kace_cloud_worker_actions_queue_executions/src/DebugOverride.mjs)
 *   3. tenant.apps_debug — historical per-tenant DynamoDB attribute
 *
 * Recognized values for env vars: 'true'/'1' enable, 'false'/'0' disable.
 * Anything else (including '', 'undefined', or unset) falls through to the
 * next level.
 */
function isDebugEnabled() {
    const fromEnv = parseBoolEnv(process.env.APPS_DEBUG);
    if (fromEnv !== null) return fromEnv;

    const fromOverride = parseBoolEnv(process.env.APPS_DEBUG_OVERRIDE);
    if (fromOverride !== null) return fromOverride;

    return readTenantDebugFlags().enabled;
}

/**
 * Resolves the effective debug level for the current log call.
 *
 * Resolution chain (higher wins):
 *   1. process.env.APPS_DEBUG_LEVEL — '1' or '2'
 *   2. tenant.apps_debug_level — historical per-tenant attribute
 *
 * Default when no level is determined: 1.
 */
function resolveDebugLevel() {
    const fromEnv = parseLevelEnv(process.env.APPS_DEBUG_LEVEL);
    if (fromEnv !== null) return fromEnv;

    return readTenantDebugFlags().level;
}

/**
 * Helper class for structured logging with multi-tenant support
 *
 * Logs are formatted as JSON with:
 * - timestamp: ISO 8601
 * - level: INFO, ERROR, DEBUG, etc.
 * - tenant_id: Extracted from TenantContext (AsyncLocalStorage)
 * - service: Lambda function name
 * - message: Main log message
 * - metadata: Additional context
 *
 * @example
 * Helper.logInfo('User created', { userId: 123 });
 * // Output: {"timestamp":"2025-12-22T...","level":"INFO","tenant_id":"acme","service":"kace_cloud_api_users","message":"User created","userId":123}
 */
export class Helper {
    /**
     * Builds structured log object with tenant context
     * @private
     */
    static #buildLogObject(level, message, metadata = {}) {
        // Get tenant ID from TenantContext (AsyncLocalStorage)
        const tenantId = TenantContext.getTenantId() || 'system';
        // Workers set a per-execution `service` label via TenantContext.runForJob
        // (e.g. `JobName-<uuid>`); Lambdas leave it unset and fall back to the
        // function name env var.
        const service = TenantContext.getService() || process.env.AWS_LAMBDA_FUNCTION_NAME || 'local';

        return {
            timestamp: new Date().toISOString(),
            level,
            tenant_id: tenantId,
            service,
            message,
            ...metadata,
        };
    }

    /**
     * Formats log output based on environment
     * @private
     */
    static #formatLog(logObject) {
        // Structured JSON for CloudWatch
        if (process.env.NODE_ENV !== 'test') {
            return JSON.stringify(logObject);
        }
        // Human-readable for tests
        return `[${logObject.level}] [${logObject.tenant_id}] ${logObject.message}`;
    }

    /**
     * Coerces an arbitrary value to something safe to embed in a single-line
     * JSON log entry. Plain objects are kept as-is so they nest cleanly; values
     * that cannot be JSON-serialized (circular refs, functions, etc.) fall back
     * to a compact util.inspect string.
     * @private
     */
    static #safeInspect(value) {
        if (value === null || value === undefined) return value;
        const t = typeof value;
        if (t === 'string' || t === 'number' || t === 'boolean') return value;
        try {
            JSON.stringify(value);
            return value;
        } catch {
            return util.inspect(value, { breakLength: Infinity, compact: true, depth: 5 });
        }
    }

    /**
     * Legacy variadic fallback: collapses any number of args into a single-line
     * structured JSON entry so log aggregators (CloudWatch, Loki, Splunk) ingest
     * it as one event. Replaces the previous `console.log(...arguments)` path
     * which produced multi-line util.inspect output split into separate events
     * by newline-based ingesters.
     * @private
     */
    static #legacyFallback(level, args) {
        const first = args.length > 0 ? args[0] : '';
        const extras = args.slice(1).map((a) => Helper.#safeInspect(a));
        const message =
            typeof first === 'string' ? first : util.inspect(first, { breakLength: Infinity, compact: true, depth: 5 });
        const metadata = extras.length > 0 ? { args: extras } : {};
        const logObject = Helper.#buildLogObject(level, message, metadata);
        const out = Helper.#formatLog(logObject);
        if (level === 'ERROR') {
            console.error(out); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            console.log(out); // SONAR-EXC: NODEJS No expone logs porque es server-side
        }
    }

    /**
     * Log info level message
     * @param {string} message - Main message
     * @param {Object} metadata - Additional context
     */
    static logInfo(message, metadata = {}) {
        if (process.env.NODE_ENV === 'test' && !forceShowLogsInTests) {
            return;
        }

        // Support legacy variadic args
        if (typeof message === 'string' && typeof metadata === 'object' && arguments.length <= 2) {
            const logObject = this.#buildLogObject('INFO', message, metadata);
            console.log(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            Helper.#legacyFallback('INFO', Array.from(arguments));
        }
    }

    /**
     * Log error level message
     * @param {string} message - Error message
     * @param {Error|Object} errorOrMetadata - Error object or metadata
     */
    static logError(message, errorOrMetadata = {}) {
        const metadata = {};

        // Support legacy variadic args
        if (typeof message === 'string' && arguments.length <= 2) {
            if (errorOrMetadata instanceof Error) {
                metadata.error = errorOrMetadata.message;
                metadata.stack = errorOrMetadata.stack;
                metadata.errorName = errorOrMetadata.name;
            } else if (typeof errorOrMetadata === 'object') {
                Object.assign(metadata, errorOrMetadata);
            }

            const logObject = this.#buildLogObject('ERROR', message, metadata);
            console.error(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            Helper.#legacyFallback('ERROR', Array.from(arguments));
        }
    }

    /**
     * Log warning level message
     * @param {string} message - Warning message
     * @param {Error|Object} errorOrMetadata - Error object or metadata
     */
    static logWarning(message, errorOrMetadata = {}) {
        if (process.env.NODE_ENV === 'test' && !forceShowLogsInTests) {
            return;
        }

        const metadata = {};

        // Support legacy variadic args
        if (typeof message === 'string' && arguments.length <= 2) {
            if (errorOrMetadata instanceof Error) {
                metadata.error = errorOrMetadata.message;
                metadata.stack = errorOrMetadata.stack;
                metadata.errorName = errorOrMetadata.name;
            } else if (typeof errorOrMetadata === 'object') {
                Object.assign(metadata, errorOrMetadata);
            }

            const logObject = this.#buildLogObject('WARNING', message, metadata);
            console.warn(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            Helper.#legacyFallback('WARNING', Array.from(arguments));
        }
    }

    /**
     * Log debug level message
     * @param {string} message - Debug message
     * @param {Object} metadata - Additional context
     */
    static logDebug(message, metadata = {}) {
        if (!isDebugEnabled() || (process.env.NODE_ENV === 'test' && !forceShowLogsInTests)) {
            return;
        }

        if (typeof metadata === 'string') {
            try {
                const parsed = JSON.parse(metadata);
                metadata = parsed;
            } catch (error) {
                // No debe detener el flujo;
            }
        }
        // Support legacy variadic args
        if (typeof message === 'string' && typeof metadata === 'object' && arguments.length <= 2) {
            const logObject = this.#buildLogObject('DEBUG', message, metadata);
            console.log(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            Helper.#legacyFallback('DEBUG', Array.from(arguments));
        }
    }

    /**
     * Log debug level 2 message (verbose debugging)
     * @param {string} message - Debug message
     * @param {Object} metadata - Additional context
     */
    static logDebug2(message, metadata = {}) {
        if (
            !isDebugEnabled() ||
            (process.env.NODE_ENV === 'test' && !forceShowLogsInTests) ||
            resolveDebugLevel() !== 2
        ) {
            return;
        }

        // Support legacy variadic args
        if (typeof message === 'string' && typeof metadata === 'object' && arguments.length <= 2) {
            const logObject = this.#buildLogObject('DEBUG2', message, metadata);
            console.log(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
        } else {
            Helper.#legacyFallback('DEBUG2', Array.from(arguments));
        }
    }

    /**
     * Log CloudWatch Embedded Metric Format (EMF) for metrics
     * Creates custom metrics in CloudWatch Metrics with tenant dimension
     *
     * @param {string} metricName - Metric name
     * @param {number} value - Metric value
     * @param {string} unit - Unit (Count, Milliseconds, Bytes, etc.)
     * @param {Object} dimensions - Additional dimensions
     *
     * @example
     * Helper.logMetric('CaseCreated', 1);
     * Helper.logMetric('APILatency', 245, 'Milliseconds');
     * Helper.logMetric('DBQueryTime', 50, 'Milliseconds', { operation: 'SELECT' });
     */
    static logMetric(metricName, value, unit = 'Count', dimensions = {}) {
        if (process.env.NODE_ENV === 'test') {
            return;
        }

        // Get tenant ID from TenantContext (AsyncLocalStorage)
        const tenantId = TenantContext.getTenantId() || 'system';
        const service = process.env.AWS_LAMBDA_FUNCTION_NAME || 'local';

        const dimensionSet = [['TenantId', 'Service'], ...Object.keys(dimensions).map((key) => ['TenantId', key])];

        const emfLog = {
            _aws: {
                Timestamp: Date.now(),
                CloudWatchMetrics: [
                    {
                        Namespace: 'KACECloud/MultiTenant',
                        Dimensions: dimensionSet,
                        Metrics: [
                            {
                                Name: metricName,
                                Unit: unit,
                            },
                        ],
                    },
                ],
            },
            TenantId: tenantId,
            Service: service,
            [metricName]: value,
            ...dimensions,
        };

        console.log(JSON.stringify(emfLog)); // SONAR-EXC: NODEJS No expone logs porque es server-side
    }

    /**
     * Start performance timer. Emits a structured JSON entry with the same
     * shape as `logInfo` so it can be filtered in CloudWatch with the same
     * fields (timestamp, level, tenant_id, service, message, metadata).
     * @param {string} name - Timer name
     */
    static logTime(name) {
        if (!isDebugEnabled() || process.env.NODE_ENV === 'test') {
            return;
        }
        activeTimers.set(name, process.hrtime.bigint());
    }

    /**
     * End performance timer. Emits a structured JSON entry mirroring
     * `logInfo`, including the elapsed duration in milliseconds.
     * @param {string} name - Timer name
     */
    static logTimeEnd(name) {
        if (!isDebugEnabled() || process.env.NODE_ENV === 'test') {
            return;
        }
        const start = activeTimers.get(name);
        if (start === undefined) {
            return;
        }
        activeTimers.delete(name);
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const logObject = this.#buildLogObject('INFO', `Timer ended: ${name}`, {
            timer: name,
            duration_ms: Number(durationMs.toFixed(3)),
        });
        console.log(this.#formatLog(logObject)); // SONAR-EXC: NODEJS No expone logs porque es server-side
    }

    static runOnlyOnDebug = (fn) => {
        if (isDebugEnabled()) {
            fn();
        }
    };
}
