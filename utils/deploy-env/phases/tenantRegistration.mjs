import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { awsJson } from '../aws.mjs';
import { AbortedError } from '../errors.mjs';
import { withTempDir } from '../tempDir.mjs';
import { TENANT_ID_KEYS } from './preflight.mjs';

// Usernames (db_user, channel_hub_user, aws_css_username, ...) count as credentials too: never show them in cleartext.
const SENSITIVE_FIELD = /password|secret|token|key|user|credential/i;

export function parseTableArn(arn) {
    const match = /^arn:aws[\w-]*:dynamodb:([\w-]+):\d+:table\/([^/]+)/.exec(arn || '');
    if (!match) {
        throw new Error(`AWS_DYNAMODB_MULTITENANT_TABLE_ARN no es un ARN de tabla válido: "${arn || ''}"`);
    }
    return { region: match[1], table: match[2] };
}

export function tenantId(env) {
    return TENANT_ID_KEYS.map((key) => env[key]).find(Boolean) || '';
}

export function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function display(field, attribute) {
    if (attribute === undefined) {
        return '(no existe)';
    }
    if (SENSITIVE_FIELD.test(field)) {
        return '****';
    }
    const raw = JSON.stringify(Object.values(attribute)[0]);
    return raw.length > 60 ? `${raw.slice(0, 57)}...` : raw;
}

export function diffItems(existing, generated) {
    return Object.keys(generated)
        .filter((field) => stableStringify(existing[field]) !== stableStringify(generated[field]))
        .map((field) => ({
            field,
            before: display(field, existing[field]),
            after: display(field, generated[field]),
        }));
}

export function describeDiff(diff) {
    return diff.map((change) => `~ ${change.field}: ${change.before} → ${change.after}`);
}

async function generateItem(ctx, id, dir) {
    const out = path.join(dir, 'tenant.json');
    const script = path.join(ctx.rootDir, 'utils/nodejs/generateTenantJson.mjs');
    const result = await ctx.run('node', [script, ctx.envFile, '--id', id, '--dynamodb', '-o', out]);
    if (result.code !== 0) {
        throw new Error(`generateTenantJson falló:\n${(result.stderr || result.stdout).trim()}`);
    }
    return JSON.parse(readFileSync(out, 'utf8'));
}

async function loadState(ctx, dir) {
    const id = tenantId(ctx.env);
    if (!id) {
        return null;
    }
    const target = parseTableArn(ctx.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN);
    const generated = await generateItem(ctx, id, dir);
    const data = await awsJson(
        ctx,
        [
            'dynamodb',
            'get-item',
            '--table-name',
            target.table,
            '--key',
            JSON.stringify({ id: { S: id } }),
            '--consistent-read',
        ],
        { region: target.region }
    );
    const existing = data.Item || null;
    return {
        id,
        target,
        generated,
        existing,
        diff: existing ? diffItems(existing, generated) : [],
    };
}

async function putItem(ctx, state, dir, item, { conditional }) {
    // Por fichero 0600 y no por argv: el item lleva credenciales de BD.
    const file = path.join(dir, 'item.json');
    writeFileSync(file, JSON.stringify(item), { mode: 0o600 });
    const args = ['dynamodb', 'put-item', '--table-name', state.target.table, '--item', `file://${file}`];
    if (conditional) {
        args.push('--condition-expression', 'attribute_not_exists(id)');
    }
    await awsJson(ctx, args, { region: state.target.region });
}

export const tenantRegistration = {
    name: 'tenant-registration',
    async isDone(ctx) {
        if (ctx.flags.dryRun && !ctx.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN) {
            return false;
        }
        return withTempDir(async (dir) => {
            const state = await loadState(ctx, dir);
            return Boolean(state?.existing) && state.diff.length === 0;
        });
    },
    async plan(ctx) {
        if (!ctx.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN) {
            const id = tenantId(ctx.env);
            return [
                `La tabla de tenants aún no existe (la crea tenant-stack): se registrará el tenant ${
                    id || 'con el id que genere preflight'
                }`,
            ];
        }
        return withTempDir(async (dir) => {
            const state = await loadState(ctx, dir);
            if (!state) {
                return ['Se registrará el tenant con el id que genere preflight'];
            }
            if (!state.existing) {
                return [`Se registraría el tenant ${state.id} en ${state.target.table}`];
            }
            const lines = [
                `El tenant ${state.id} ya existe y difiere en ${state.diff.length} campo(s):`,
                ...describeDiff(state.diff),
            ];
            if (!ctx.flags.overwriteTenant) {
                lines.push('Sin --overwrite-tenant no se sobrescribe (terminará en aviso).');
            }
            return lines;
        });
    },
    async run(ctx) {
        return withTempDir(async (dir) => {
            const state = await loadState(ctx, dir);
            if (!state) {
                throw new Error('No hay VITE_TENANT_ID ni TENANT_ID: la fase preflight debió generarlo.');
            }
            if (!state.existing) {
                ctx.write(`Registrando el tenant ${state.id} en ${state.target.table}\n`);
                await putItem(ctx, state, dir, state.generated, { conditional: true });
                return undefined;
            }
            if (!state.diff.length) {
                return undefined;
            }
            ctx.write(
                `El tenant ${state.id} ya existe y difiere en ${state.diff.length} campo(s):\n` +
                    `${describeDiff(state.diff)
                        .map((line) => `  ${line}`)
                        .join('\n')}\n`
            );
            if (!ctx.flags.overwriteTenant) {
                return {
                    warning: `Tenant ${state.id} no sobrescrito (${state.diff.length} campo(s) difieren). Usa --overwrite-tenant para aplicarlo.`,
                };
            }
            if (!ctx.flags.yes && !(await ctx.confirm(`¿Sobrescribir esos campos del tenant ${state.id}?`))) {
                throw new AbortedError('Sobrescritura del tenant cancelada por el usuario.');
            }
            await putItem(
                ctx,
                state,
                dir,
                { ...state.existing, ...state.generated },
                {
                    conditional: false,
                }
            );
            return undefined;
        });
    },
};
