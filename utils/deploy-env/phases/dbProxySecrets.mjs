import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { awsJson } from '../aws.mjs';
import { timestamp } from '../envFile.mjs';
import { AbortedError } from '../errors.mjs';
import { withTempDir } from '../tempDir.mjs';

export const WAIT = Object.freeze({ intervalMs: 15000, timeoutMs: 600000 });

const HOST_KEYS = Object.freeze(['DB_HOST', 'DB_HOST_READER']);
const USER_KEYS = Object.freeze([
    ['DB_USER', 'DB_PASSWORD'],
    ['DB_AUXILIAR_USER', 'DB_AUXILIAR_PASSWORD'],
]);
const PROXY_HOST = /\.proxy-[a-z0-9]+\.[a-z0-9-]+\.rds\.amazonaws\.com$/i;
const AUTH_TEMPLATE_FIELDS = Object.freeze(['AuthScheme', 'IAMAuth', 'ClientPasswordAuthType']);
const DEFAULT_AUTH = Object.freeze({
    AuthScheme: 'SECRETS',
    IAMAuth: 'DISABLED',
    ClientPasswordAuthType: 'POSTGRES_SCRAM_SHA_256',
});

function hostOf(env, key) {
    return String(env[key] || '')
        .trim()
        .toLowerCase();
}

export function pointsToProxy(env) {
    return HOST_KEYS.some((key) => PROXY_HOST.test(hostOf(env, key)));
}

export function findProxy(env, proxies = [], endpoints = []) {
    const nameByHost = new Map();
    for (const item of [...proxies, ...endpoints]) {
        if (item.Endpoint) {
            nameByHost.set(item.Endpoint.toLowerCase(), item.DBProxyName);
        }
    }
    const matches = HOST_KEYS.map((key) => ({ key, name: nameByHost.get(hostOf(env, key)) })).filter(
        (match) => match.name
    );
    if (!matches.length) {
        return null;
    }
    const names = [...new Set(matches.map((match) => match.name))];
    if (names.length > 1) {
        throw new Error(`DB_HOST y DB_HOST_READER apuntan a proxies distintos (${names.join(', ')}).`);
    }
    const proxy = proxies.find((candidate) => candidate.DBProxyName === names[0]);
    if (!proxy) {
        throw new Error(`El endpoint detectado es del proxy ${names[0]}, que no aparece en describe-db-proxies.`);
    }
    return { proxy, matchedBy: matches[0].key };
}

export function wantedUsers(env) {
    const users = [];
    for (const [key, passwordKey] of USER_KEYS) {
        const username = String(env[key] || '').trim();
        if (!username) {
            continue;
        }
        const password = env[passwordKey] || '';
        if (!password) {
            throw new Error(`${key} tiene valor pero ${passwordKey} está vacía.`);
        }
        const repeated = users.find((user) => user.username === username);
        if (repeated) {
            if (repeated.password !== password) {
                throw new Error(`${key} repite el usuario de ${repeated.key} con otra contraseña.`);
            }
            continue;
        }
        users.push({ key, passwordKey, username, password });
    }
    return users;
}

export function parseSecret(text) {
    try {
        const value = JSON.parse(text || '');
        return typeof value?.username === 'string' && typeof value?.password === 'string'
            ? { username: value.username, password: value.password }
            : null;
    } catch {
        return null;
    }
}

export function classifyUser(user, { associated = [], byName = null, authArns = new Set() } = {}) {
    const linked = associated.find((secret) => secret.username === user.username);
    if (linked) {
        return { user, arn: linked.arn, action: linked.password === user.password ? 'ok' : 'mismatch' };
    }
    if (!byName) {
        return { user, action: 'create' };
    }
    if (byName.username !== user.username || byName.password !== user.password) {
        return { user, arn: byName.arn, action: 'mismatch' };
    }
    if (authArns.has(byName.arn)) {
        return { user, arn: byName.arn, action: 'ok' };
    }
    return {
        user,
        arn: byName.arn,
        action: 'associate',
        needsPolicy: !byName.hasPolicy,
        foreignPolicy: Boolean(byName.hasPolicy && !byName.policyAllowsRole),
    };
}

function withoutNulls(entry) {
    return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== null && value !== undefined));
}

/**
 * modify-db-proxy --auth SUSTITUYE la lista entera: se devuelve la actual completa más las nuevas.
 * Las nuevas copian el esquema de la primera existente para no mezclar modos de autenticación.
 */
export function buildAuth(current = [], newArns = []) {
    const template = current.length
        ? Object.fromEntries(AUTH_TEMPLATE_FIELDS.map((field) => [field, current[0][field] ?? DEFAULT_AUTH[field]]))
        : { ...DEFAULT_AUTH };
    const known = new Set(current.map((entry) => entry.SecretArn));
    const added = [...new Set(newArns)]
        .filter((arn) => !known.has(arn))
        .map((SecretArn) => ({ ...template, SecretArn }));
    return [...current.map(withoutNulls), ...added];
}

export function buildResourcePolicy(roleArn) {
    return {
        Version: '2012-10-17',
        Statement: [
            {
                Sid: 'AllowRdsProxyRead',
                Effect: 'Allow',
                Principal: { AWS: roleArn },
                Action: 'secretsmanager:GetSecretValue',
                Resource: '*',
            },
        ],
    };
}

export function missingAfterModify(expectedArns = [], afterAuth = []) {
    const present = new Set(afterAuth.map((entry) => entry.SecretArn));
    return expectedArns.filter((arn) => !present.has(arn));
}

export function maskSecretArn(arn) {
    return String(arn || '').replace(/(:secret:)(.+)$/, (_, prefix, name) => {
        const suffix = name.match(/-[A-Za-z0-9]{6}$/);
        return `${prefix}****${suffix ? suffix[0] : ''}`;
    });
}

export function roleName(proxy) {
    return String(proxy.RoleArn || '')
        .split('/')
        .pop();
}

async function detect(ctx) {
    if (!pointsToProxy(ctx.env)) {
        return null;
    }
    const { DBProxies = [] } = await awsJson(ctx, ['rds', 'describe-db-proxies']);
    const { DBProxyEndpoints = [] } = await awsJson(ctx, ['rds', 'describe-db-proxy-endpoints']);
    const found = findProxy(ctx.env, DBProxies, DBProxyEndpoints);
    if (!found) {
        const keys = HOST_KEYS.filter((key) => PROXY_HOST.test(hostOf(ctx.env, key)));
        const subject = keys.length > 1 ? `${keys.join(' y ')} parecen endpoints` : `${keys[0]} parece un endpoint`;
        const scope = ctx.account ? `${ctx.region} (cuenta ${ctx.account})` : ctx.region;
        throw new Error(
            `${subject} de RDS Proxy pero no coincide${keys.length > 1 ? 'n' : ''} con ningún proxy de la región ` +
                `${scope}. ¿Perfil o región AWS equivocados?`
        );
    }
    return found;
}

async function readSecret(ctx, secretId) {
    const data = await awsJson(ctx, ['secretsmanager', 'get-secret-value', '--secret-id', secretId]);
    return parseSecret(data.SecretString);
}

async function readByName(ctx, name, roleArn) {
    let described;
    try {
        described = await awsJson(ctx, ['secretsmanager', 'describe-secret', '--secret-id', name]);
    } catch (error) {
        if (/ResourceNotFoundException/.test(error?.result?.stderr || '')) {
            return null;
        }
        throw error;
    }
    const value = await readSecret(ctx, described.ARN);
    const { ResourcePolicy: policy = '' } = await awsJson(ctx, [
        'secretsmanager',
        'get-resource-policy',
        '--secret-id',
        described.ARN,
    ]);
    return {
        arn: described.ARN,
        username: value?.username,
        password: value?.password,
        hasPolicy: Boolean(policy),
        policyAllowsRole: policy.includes(roleArn),
    };
}

export function redactUsers(message, users = []) {
    let text = String(message ?? '');
    const ordered = [...users].sort((left, right) => right.username.length - left.username.length);
    for (const user of ordered) {
        text = text.split(user.username).join(`<${user.key}>`);
    }
    return text;
}

async function withRedactedErrors(users, fn) {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof AbortedError) {
            throw error;
        }
        throw new Error(redactUsers(error?.message, users));
    }
}

export async function loadState(ctx) {
    const found = await detect(ctx);
    if (!found) {
        return null;
    }
    const users = wantedUsers(ctx.env);
    return withRedactedErrors(users, async () => {
        const { proxy } = found;
        const auth = proxy.Auth || [];
        const warnings = [];
        const associated = [];
        for (const entry of auth) {
            const value = await readSecret(ctx, entry.SecretArn).catch(() => null);
            if (value) {
                associated.push({ arn: entry.SecretArn, ...value });
            } else {
                warnings.push(`no se pudo leer el secreto asociado ${maskSecretArn(entry.SecretArn)}`);
            }
        }
        const authArns = new Set(auth.map((entry) => entry.SecretArn));
        const plans = [];
        for (const user of users) {
            const linked = associated.some((secret) => secret.username === user.username);
            const byName = linked ? null : await readByName(ctx, user.username, proxy.RoleArn);
            const result = classifyUser(user, { associated, byName, authArns });
            if (result.action === 'mismatch') {
                throw new Error(
                    `El secreto ${maskSecretArn(result.arn)} de ${user.key} no coincide con ${user.key}/${user.passwordKey} ` +
                        'del .env; no se toca. Corrige el que esté mal (la verdad está en la BD).'
                );
            }
            if (result.foreignPolicy) {
                warnings.push(
                    `${user.key}: su secreto ya tiene una política de recurso que no incluye ${roleName(proxy)}; no se toca`
                );
            }
            plans.push(result);
        }
        return { ...found, plans, warnings };
    });
}

export function describePlan(state) {
    const role = roleName(state.proxy);
    const lines = [`Proxy ${state.proxy.DBProxyName} (detectado por ${state.matchedBy}):`];
    for (const item of state.plans) {
        const key = item.user.key;
        if (item.action === 'ok') {
            lines.push(`= el secreto de ${key} ya está asociado`);
            continue;
        }
        if (item.action === 'create') {
            lines.push(`+ secreto nuevo para ${key}`);
        }
        if (item.action === 'create' || item.needsPolicy) {
            lines.push(`+ política de acceso para ${role} en el secreto de ${key}`);
        }
        lines.push(`+ asociar el secreto de ${key}`);
    }
    return [...lines, ...state.warnings.map((warning) => `! ${warning}`)];
}

async function describeProxy(ctx, name) {
    const { DBProxies = [] } = await awsJson(ctx, ['rds', 'describe-db-proxies', '--db-proxy-name', name]);
    return DBProxies[0] || null;
}

async function waitAvailable(ctx, name) {
    for (let waited = 0; ; waited += WAIT.intervalMs) {
        const proxy = await describeProxy(ctx, name);
        if (!proxy) {
            throw new Error(`El proxy ${name} ya no existe.`);
        }
        if (proxy.Status === 'available') {
            return proxy;
        }
        if (waited >= WAIT.timeoutMs) {
            throw new Error(`El proxy ${name} sigue en ${proxy.Status} tras ${WAIT.timeoutMs / 60000} min.`);
        }
        ctx.write(`  esperando al proxy ${name} (${proxy.Status})…\n`);
        await ctx.sleep(WAIT.intervalMs);
    }
}

/** La contraseña viaja por fichero 0600 (file://), nunca por argv, y el fichero se borra siempre. */
async function createSecret(ctx, user) {
    return withTempDir(async (dir) => {
        const file = path.join(dir, 'secret.json');
        writeFileSync(file, JSON.stringify({ username: user.username, password: user.password }), { mode: 0o600 });
        const created = await awsJson(ctx, [
            'secretsmanager',
            'create-secret',
            '--name',
            user.username,
            '--description',
            'Credenciales de BD para RDS Proxy (deploy:env)',
            '--secret-string',
            `file://${file}`,
        ]);
        return created.ARN;
    });
}

async function putPolicy(ctx, secretArn, roleArn) {
    await awsJson(ctx, [
        'secretsmanager',
        'put-resource-policy',
        '--secret-id',
        secretArn,
        '--resource-policy',
        JSON.stringify(buildResourcePolicy(roleArn)),
        '--block-public-policy',
    ]);
}

async function applyChanges(ctx, state, pending) {
    const name = state.proxy.DBProxyName;
    await waitAvailable(ctx, name);
    const newArns = [];
    for (const item of pending) {
        const arn = item.action === 'create' ? await createSecret(ctx, item.user) : item.arn;
        if (item.action === 'create' || item.needsPolicy) {
            await putPolicy(ctx, arn, state.proxy.RoleArn);
        }
        newArns.push(arn);
    }
    // Se relee justo antes: la lista de loadState puede tener minutos y otro despliegue pudo cambiarla.
    const before = (await describeProxy(ctx, name))?.Auth || [];
    const backup = `${ctx.envFile}.proxy-auth-${timestamp(ctx.now())}.json`;
    writeFileSync(backup, `${JSON.stringify(buildAuth(before, []), null, 4)}\n`, { mode: 0o600 });
    ctx.write(`Copia de la lista Auth previa: ${backup}\n`);
    const { DBProxy: modified = {} } = await awsJson(ctx, [
        'rds',
        'modify-db-proxy',
        '--db-proxy-name',
        name,
        '--auth',
        JSON.stringify(buildAuth(before, newArns)),
    ]);
    const expected = [...before.map((entry) => entry.SecretArn), ...newArns];
    const lost = missingAfterModify(expected, modified.Auth || []);
    if (lost.length) {
        throw new Error(
            `Tras modify-db-proxy faltan ${lost.length} secreto(s) en ${name}. La lista previa está en ${backup}; ` +
                `restáurala con: aws rds modify-db-proxy --db-proxy-name ${name} --region ${ctx.region} --auth file://${backup}`
        );
    }
    await waitAvailable(ctx, name);
    ctx.write(`Proxy ${name} actualizado: ${newArns.length} secreto(s) asociado(s).\n`);
}

export const dbProxySecrets = {
    name: 'db-proxy-secrets',
    async applies(ctx) {
        return Boolean(await detect(ctx));
    },
    async isDone(ctx) {
        const state = await loadState(ctx);
        return !state || state.plans.every((item) => item.action === 'ok');
    },
    async plan(ctx) {
        const state = await loadState(ctx);
        return state ? describePlan(state) : [];
    },
    async run(ctx) {
        const state = await loadState(ctx);
        if (!state) {
            return undefined;
        }
        const name = state.proxy.DBProxyName;
        ctx.write(`${describePlan(state).join('\n')}\n`);
        const pending = state.plans.filter((item) => item.action !== 'ok');
        if (pending.length) {
            if (!ctx.flags.yes && !(await ctx.confirm(`¿Aplicar estos cambios en el proxy ${name}?`))) {
                throw new AbortedError('Cambio en el RDS Proxy cancelado por el usuario.');
            }
            await withRedactedErrors(
                state.plans.map((item) => item.user),
                () => applyChanges(ctx, state, pending)
            );
        }
        return state.warnings.length
            ? { warning: `${state.warnings.length} aviso(s) en el proxy ${name}: revisa las líneas «!»` }
            : undefined;
    },
};
