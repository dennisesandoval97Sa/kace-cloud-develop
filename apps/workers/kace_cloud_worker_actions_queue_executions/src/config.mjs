const parsePositiveInt = (raw, name, fallback) => {
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer (received "${raw}")`);
    }
    return value;
};

const parseEnum = (raw, name, allowed, fallback) => {
    if (raw === undefined || raw === null || raw === '') {
        return fallback;
    }
    const value = String(raw).toLowerCase();
    if (!allowed.includes(value)) {
        throw new Error(`${name} must be one of ${allowed.join(', ')} (received "${raw}")`);
    }
    return value;
};

export const loadConfig = (env = process.env) => ({
    workerConcurrency: parsePositiveInt(env.WORKER_CONCURRENCY, 'WORKER_CONCURRENCY', 5),
    // Selects which schedulers this process runs. `fast` = the per-minute jobs (actions queue,
    // automated assignment, users/groups actions); `ans` = only the heavy SLA recalculation;
    // `all` = both (local/dev). Default `fast` is fail-safe: the heavy AnsCalculateJob never runs
    // unless a process explicitly opts in, so it can never freeze the fast worker's event loop.
    workerMode: parseEnum(env.WORKER_MODE, 'WORKER_MODE', ['fast', 'ans', 'all'], 'fast'),
    shutdownGraceSeconds: parsePositiveInt(env.SHUTDOWN_GRACE_SECONDS, 'SHUTDOWN_GRACE_SECONDS', 1800),
    lockStalenessMinutes: parsePositiveInt(env.LOCK_STALENESS_MINUTES, 'LOCK_STALENESS_MINUTES', 30),
    healthPort: parsePositiveInt(env.HEALTH_PORT, 'HEALTH_PORT', 8080),
    debugOverrideParameterName: env.DEBUG_OVERRIDE_PARAMETER_NAME || '',
    awsRegion: env.AWS_REGION || env.TARGET_DYNAMODB_REGION || 'us-east-1',
});
