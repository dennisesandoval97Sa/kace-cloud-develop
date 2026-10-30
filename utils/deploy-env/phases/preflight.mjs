import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runStreamed } from '../aws.mjs';
import { applyEnvUpdates } from '../context.mjs';
import { AbortedError } from '../errors.mjs';
import { DERIVED_ENV_KEYS } from '../outputMap.mjs';

// Mismo orden que ENV_OVERRIDES.id de utils/nodejs/generateTenantJson.mjs.
export const TENANT_ID_KEYS = Object.freeze(['TENANT_ID', 'VITE_TENANT_ID']);

// Misma regla que validate-env-deploy.sh: claves no comentadas de .env.example.
export function readContractKeys(exampleText) {
    return [...new Set([...exampleText.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((match) => match[1]))];
}

export function findMissingKeys(contractKeys, env) {
    const excluded = new Set([...DERIVED_ENV_KEYS, ...TENANT_ID_KEYS]);
    return contractKeys.filter((key) => !excluded.has(key) && !(key in env));
}

export const preflight = {
    name: 'preflight',
    always: true,
    async run(ctx) {
        const example = readFileSync(path.join(ctx.rootDir, '.env.example'), 'utf8');
        const missing = findMissingKeys(readContractKeys(example), ctx.env);
        if (missing.length) {
            throw new Error(
                `Faltan ${missing.length} variable(s) de .env.example en ${path.basename(ctx.envFile)}:\n` +
                    missing.map((key) => `  - ${key}`).join('\n')
            );
        }
        if (!ctx.serviceName) {
            throw new Error('APPS_SERVICE_NAME está vacío: sin él no se pueden derivar los nombres de stack.');
        }

        const target = await ctx.identity.resolve({
            region: ctx.region,
            expectedAccount: ctx.flags.expectAccount || ctx.env.AWS_ACCOUNT_ID || '',
        });
        if (!target.ok) {
            throw new Error(target.message);
        }
        if (ctx.flags.expectAccount && target.account !== ctx.flags.expectAccount) {
            throw new Error(`La cuenta AWS activa (${target.account}) no es la esperada (${ctx.flags.expectAccount}).`);
        }
        ctx.account = target.account;

        if (ctx.flags.dryRun) {
            ctx.write(`Cuenta ${target.account} (${ctx.region}) · dry-run: no se pide confirmación ni se instala\n`);
        } else if (!(await ctx.identity.confirm(target))) {
            throw new AbortedError('Despliegue cancelado por el usuario.');
        }

        // El id debe existir ANTES de la fase services: validate-env-deploy.sh valida el contrato
        // (VITE_TENANT_ID está en .env.example) y el frontal lo compila en su bundle.
        if (!TENANT_ID_KEYS.some((key) => ctx.env[key])) {
            ctx.write('No hay id de tenant: se genera uno y se guarda en VITE_TENANT_ID\n');
            applyEnvUpdates(ctx, { VITE_TENANT_ID: randomUUID() });
        }

        if (!ctx.flags.dryRun) {
            await runStreamed(ctx, 'pnpm', ['install', '--frozen-lockfile'], 'pnpm install');
        }
    },
};
