import { readFileSync } from 'node:fs';
import { formatChanges, parseEnv, writeEnvUpdates } from './envFile.mjs';

export function resolveRegion(env, processEnv = process.env) {
    return processEnv.AWS_REGION || processEnv.AWS_DEFAULT_REGION || env.AWS_REGION || 'us-east-1';
}

export function normalizeAnswer(answer) {
    if (typeof answer === 'boolean') {
        return answer;
    }
    const text = String(answer ?? '')
        .trim()
        .toLowerCase();
    return ['s', 'si', 'sí', 'y', 'yes'].includes(text);
}

export function createContext({
    rootDir,
    envFile,
    flags,
    run,
    ask,
    write,
    now = () => new Date(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    processEnv = process.env,
}) {
    const ctx = {
        rootDir,
        envFile,
        flags,
        ask,
        write,
        now,
        sleep,
        env: {},
        region: '',
        serviceName: '',
        account: '',
        envBackup: { done: false, path: '' },
        reloadEnv() {
            ctx.env = parseEnv(readFileSync(envFile, 'utf8'));
            ctx.region = resolveRegion(ctx.env, processEnv);
            ctx.serviceName = ctx.env.APPS_SERVICE_NAME || '';
        },
        run(cmd, args = [], opts = {}) {
            return run(cmd, args, {
                cwd: rootDir,
                ...opts,
                env: {
                    ...processEnv,
                    AWS_REGION: ctx.region,
                    AWS_DEFAULT_REGION: ctx.region,
                    AWS_PAGER: '',
                    ...(opts.env || {}),
                },
            });
        },
        async confirm(message) {
            const answer = await ask({
                id: 'deployEnvConfirm',
                type: 'confirm',
                message,
                hint: 'enter confirma · no es el valor seguro',
                default: false,
            });
            return normalizeAnswer(answer);
        },
    };
    ctx.reloadEnv();
    return ctx;
}

export function applyEnvUpdates(ctx, updates) {
    const changes = writeEnvUpdates(ctx.envFile, updates, {
        dryRun: ctx.flags.dryRun,
        backupState: ctx.envBackup,
        now: ctx.now(),
    });
    ctx.write(`${formatChanges(changes).join('\n')}\n`);
    if (!ctx.flags.dryRun) {
        ctx.reloadEnv();
    }
    return changes;
}
