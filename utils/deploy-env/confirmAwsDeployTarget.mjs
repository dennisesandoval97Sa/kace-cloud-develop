import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stdout, stderr } from 'node:process';
import { pathToFileURL } from 'node:url';
import { createInteractiveAsk, paint, ui, finishCli } from './deployConsoleUi.mjs';

export function classifyAwsIdentityError(stderrText = '') {
    const text = String(stderrText).toLowerCase();
    if (
        /expiredtoken|expiredtokenexception|token has expired|security token included in the request is expired|sso session.*expired|refresh failed/.test(
            text
        )
    ) {
        return 'expired';
    }
    if (
        /unrecognizedclient|invalidclienttokenid|invalidsecurity|unable to locate credentials|could not be found|no credentials/.test(
            text
        )
    ) {
        return 'invalid';
    }
    return 'unavailable';
}

export function parseCallerIdentity(payload) {
    return {
        account: String(payload.Account ?? ''),
        arn: String(payload.Arn ?? ''),
        userId: String(payload.UserId ?? ''),
    };
}

export function parseAccountAliases(payload) {
    const aliases = payload?.AccountAliases;
    if (!Array.isArray(aliases) || aliases.length === 0) {
        return '';
    }
    return String(aliases[0] ?? '').trim();
}

export function parseAccountName(payload) {
    const nested = payload?.Account?.Name;
    const flat = payload?.AccountName;
    return String(nested ?? flat ?? '').trim();
}

export function extractJsonObject(text) {
    const raw = String(text ?? '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) {
        return '';
    }
    return raw.slice(start, end + 1);
}

export function readAwsCliName(stdout) {
    const json = extractJsonObject(stdout);
    if (json) {
        try {
            const parsed = JSON.parse(json);
            const name = parseAccountName(parsed) || parseAccountAliases(parsed);
            if (name) {
                return name;
            }
        } catch {
            // AWS CLI sometimes prints a warning before JSON; try the last line.
        }
    }
    const last =
        String(stdout ?? '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .at(-1) ?? '';
    if (!last || /^none$/i.test(last) || last === 'null' || last.startsWith('{')) {
        return '';
    }
    return last;
}

export function formatExpiredCredentialsMessage() {
    return `${paint(ui.red + ui.bold, 'Credenciales vencidas')}  ${paint(ui.dim, 'Renueva el SSO o el perfil (`aws sso login` / AWS_PROFILE) antes de desplegar.')}`;
}

export function formatAwsPreflight({ account, arn, region, expectedAccount, alias = '', name = '' }) {
    const accountName = String(name || '').trim();
    const accountAlias = String(alias || '').trim();
    const displayName = accountName || accountAlias;
    const showAliasBesideId = Boolean(accountAlias && accountAlias !== displayName);
    const lines = [
        '',
        `  ${paint(ui.bold + ui.cyan, 'Cuenta AWS')}  ${paint(ui.dim, 'a punto de recibir las Lambdas')}`,
        `  ${paint(ui.dim, '─'.repeat(44))}`,
        `  ${paint(ui.dim, 'account')}     ${paint(ui.bold + ui.white, account)}${showAliasBesideId ? paint(ui.dim, `  (${accountAlias})`) : ''}`,
        `  ${paint(ui.dim, 'nombre')}      ${
            displayName ? paint(ui.bold + ui.white, displayName) : paint(ui.dim, 'no disponible')
        }`,
    ];
    lines.push(
        `  ${paint(ui.dim, 'región')}      ${paint(ui.white, region)}`,
        `  ${paint(ui.dim, 'identidad')}   ${paint(ui.cyan, arn)}`
    );
    if (expectedAccount && expectedAccount !== account) {
        lines.push(
            `  ${paint(ui.yellow + ui.bold, 'aviso')}      AWS_ACCOUNT_ID del .env (${expectedAccount}) no coincide con ${account}.`
        );
    }
    lines.push('');
    return lines.join('\n');
}

async function lookupOptionalName(run) {
    if (typeof run !== 'function') {
        return '';
    }
    try {
        const result = await run();
        if (!result || result.code !== 0) {
            return '';
        }
        return readAwsCliName(result.stdout);
    } catch {
        return '';
    }
}

export async function resolveAwsDeployTarget({
    runSts,
    runAccountName,
    runAccountAliases,
    region,
    expectedAccount = '',
    alias = '',
    name = '',
}) {
    const result = await runSts();
    if (result.code !== 0) {
        const reason = classifyAwsIdentityError(result.stderr || result.stdout);
        const message =
            reason === 'expired'
                ? formatExpiredCredentialsMessage()
                : reason === 'invalid'
                  ? 'No hay credenciales AWS válidas. Revisa AWS_PROFILE o AWS_ACCESS_KEY_ID antes de desplegar.'
                  : `No se pudo resolver la cuenta AWS.\n${(result.stderr || result.stdout || '').trim()}`;
        return { ok: false, reason, message };
    }
    let identity;
    try {
        identity = parseCallerIdentity(JSON.parse(extractJsonObject(result.stdout) || result.stdout));
    } catch {
        return { ok: false, reason: 'unavailable', message: 'AWS devolvió una identidad que no se pudo leer.' };
    }
    if (!identity.account) {
        return { ok: false, reason: 'unavailable', message: 'AWS no devolvió un account id.' };
    }
    const [lookedUpName, lookedUpAlias] = await Promise.all([
        name ? Promise.resolve('') : lookupOptionalName(() => runAccountName?.(identity.account)),
        alias ? Promise.resolve('') : lookupOptionalName(runAccountAliases),
    ]);
    return {
        ok: true,
        ...identity,
        region,
        expectedAccount,
        alias: alias || lookedUpAlias,
        name: name || lookedUpName,
    };
}

function friendlyAccountLabel(target) {
    const displayName = String(target.name || target.alias || '').trim();
    return displayName ? `${displayName} (${target.account})` : String(target.account);
}

export function formatConfirmQuestion(target) {
    return `¿Desplegar las Lambdas en la cuenta ${friendlyAccountLabel(target)} (${target.region})? [s/N] `;
}

export async function runAwsDeployConfirmation({ target, skipConfirm, ask, write }) {
    write(`${formatAwsPreflight(target)}\n`);
    if (skipConfirm) {
        return true;
    }
    const asked = await ask({
        id: 'awsConfirm',
        type: 'confirm',
        message: `¿Desplegar las Lambdas en ${friendlyAccountLabel(target)}?`,
        hint: `${target.region} · enter confirma · no es el valor seguro`,
        default: false,
    });
    if (typeof asked === 'boolean') {
        return asked;
    }
    const answer = String(asked ?? '')
        .trim()
        .toLowerCase();
    return answer === 's' || answer === 'si' || answer === 'sí' || answer === 'y' || answer === 'yes';
}

export function readEnvFileValue(filePath, key) {
    try {
        const text = readFileSync(filePath, 'utf8');
        const match = text.match(new RegExp(`^\\s*(?:export\\s+)?${key}=(.*)$`, 'm'));
        if (!match) {
            return '';
        }
        return match[1].trim().replace(/^['"]|['"]$/g, '');
    } catch {
        return '';
    }
}

export function createAwsCliRunner(args, { timeoutMs = 12_000 } = {}) {
    return () =>
        new Promise((resolve) => {
            const child = spawn(
                'aws',
                ['--no-cli-pager', '--cli-connect-timeout', '5', '--cli-read-timeout', '10', ...args],
                {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, AWS_PAGER: '' },
                }
            );
            let stdoutText = '';
            let stderrText = '';
            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                resolve({ code: 1, stdout: stdoutText, stderr: stderrText || 'timeout' });
            }, timeoutMs);
            child.stdout.on('data', (chunk) => {
                stdoutText += chunk;
            });
            child.stderr.on('data', (chunk) => {
                stderrText += chunk;
            });
            child.on('error', (error) => {
                clearTimeout(timer);
                resolve({ code: 1, stdout: '', stderr: error.message });
            });
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ code: code ?? 1, stdout: stdoutText, stderr: stderrText });
            });
        });
}

export function createAwsStsRunner() {
    return createAwsCliRunner(['sts', 'get-caller-identity', '--output', 'json'], { timeoutMs: 20_000 });
}

export function createAwsAccountAliasRunner() {
    return createAwsCliRunner(['iam', 'list-account-aliases', '--output', 'json']);
}

export function createAwsAccountNameRunner() {
    return async (accountId) => {
        const fromAccountApi = await createAwsCliRunner([
            'account',
            'get-account-information',
            '--region',
            'us-east-1',
            '--output',
            'json',
        ])();
        if (fromAccountApi.code === 0 && readAwsCliName(fromAccountApi.stdout)) {
            return fromAccountApi;
        }
        return createAwsCliRunner([
            'organizations',
            'describe-account',
            '--account-id',
            String(accountId),
            '--region',
            'us-east-1',
            '--output',
            'json',
        ])();
    };
}

function resolveRegion() {
    return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
}

async function main(argv = process.argv.slice(2)) {
    const skipConfirm = argv.includes('--yes');
    const identityOnly = argv.includes('--identity-only');
    const envFile = path.resolve(process.cwd(), '.env');
    const target = await resolveAwsDeployTarget({
        runSts: createAwsStsRunner(),
        runAccountName: identityOnly ? undefined : createAwsAccountNameRunner(),
        runAccountAliases: identityOnly ? undefined : createAwsAccountAliasRunner(),
        region:
            process.env.AWS_REGION ||
            process.env.AWS_DEFAULT_REGION ||
            readEnvFileValue(envFile, 'AWS_REGION') ||
            resolveRegion(),
        expectedAccount: readEnvFileValue(envFile, 'AWS_ACCOUNT_ID'),
        name: process.env.AWS_ACCOUNT_NAME || readEnvFileValue(envFile, 'AWS_ACCOUNT_NAME'),
    });
    if (!target.ok) {
        stderr.write(`${target.message}\n`);
        finishCli(target.reason === 'expired' ? 2 : 1);
    }
    if (identityOnly) {
        stdout.write(
            `${JSON.stringify({
                account: target.account,
                arn: target.arn,
                region: target.region,
            })}\n`
        );
        finishCli(0);
    }
    try {
        const accepted = await runAwsDeployConfirmation({
            target,
            skipConfirm,
            ask: skipConfirm ? async () => true : createInteractiveAsk({ write: (text) => stderr.write(text) }),
            write: (text) => stderr.write(text),
        });
        if (!accepted) {
            stderr.write('Despliegue cancelado. No se instaló ni se lanzaron Lambdas.\n');
            finishCli(0);
        }
        finishCli(0);
    } catch (error) {
        stderr.write(`${error.message}\n`);
        stderr.write('No se pudo pedir confirmación. Ejecuta en una terminal o pasa --yes.\n');
        finishCli(1);
    }
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked === import.meta.url) {
    await main();
}
