#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { stderr, stdin } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCommand } from './aws.mjs';
import { createContext } from './context.mjs';
import { createEnvActivation } from './envActivation.mjs';
import { UsageError } from './errors.mjs';
import { cdkBootstrap } from './phases/cdkBootstrap.mjs';
import { cognitoClient } from './phases/cognitoClient.mjs';
import { dbProxySecrets } from './phases/dbProxySecrets.mjs';
import { eventProcessorStack } from './phases/eventProcessorStack.mjs';
import { infraStack } from './phases/infraStack.mjs';
import { migrations } from './phases/migrations.mjs';
import { preflight } from './phases/preflight.mjs';
import { services } from './phases/services.mjs';
import { tenantRegistration } from './phases/tenantRegistration.mjs';
import { tenantStack } from './phases/tenantStack.mjs';
import { formatSummary, resumeHint, runPhases } from './runner.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const PHASES = Object.freeze([
    preflight,
    cdkBootstrap,
    infraStack,
    tenantStack,
    eventProcessorStack,
    dbProxySecrets,
    migrations,
    services,
    cognitoClient,
    tenantRegistration,
]);

export const EXIT = Object.freeze({ OK: 0, FAILED: 1, USAGE: 2, ABORTED: 4 });

export const USAGE = `
Uso: pnpm run deploy:env -- <archivo.env> [opciones]

Levanta o actualiza un entorno completo. Cada fase comprueba si ya está hecha y se
salta; los outputs de CloudFormation se escriben siempre en <archivo.env>.

Opciones:
  --yes                     Sin preguntas (CI). Exige --expect-account.
  --expect-account <id>     Aborta si la cuenta AWS activa no es esta (12 dígitos).
  --from <fase>             Empieza en esa fase (preflight se ejecuta siempre).
  --only <fase>             Ejecuta solo esa fase (y preflight).
  --dry-run                 Solo consulta: muestra qué haría y el diff del .env.
  --overwrite-tenant        Sobrescribe el tenant de DynamoDB si difiere.
  --concurrency <n>         Concurrencia de cdk:deploy en services (por defecto 5).
  -h, --help                Esta ayuda.

Fases: ${PHASES.map((phase) => phase.name).join(', ')}
`;

export function parseArgs(argv, phaseNames = PHASES.map((phase) => phase.name)) {
    const args = argv[0] === '--' ? argv.slice(1) : [...argv];
    const flags = {
        envFile: '',
        yes: false,
        expectAccount: '',
        from: '',
        only: '',
        dryRun: false,
        overwriteTenant: false,
        concurrency: 0,
        help: false,
    };
    const valueAt = (index, flag) => {
        const value = args[index + 1];
        if (!value || value.startsWith('--')) {
            throw new UsageError(`${flag} necesita un valor.`);
        }
        return value;
    };

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        switch (arg) {
            case '-h':
            case '--help':
                flags.help = true;
                break;
            case '--yes':
                flags.yes = true;
                break;
            case '--dry-run':
                flags.dryRun = true;
                break;
            case '--overwrite-tenant':
                flags.overwriteTenant = true;
                break;
            case '--expect-account':
                flags.expectAccount = valueAt(index++, arg);
                break;
            case '--from':
                flags.from = valueAt(index++, arg);
                break;
            case '--only':
                flags.only = valueAt(index++, arg);
                break;
            case '--concurrency': {
                const value = valueAt(index++, arg);
                if (!/^[1-9]\d*$/.test(value)) {
                    throw new UsageError('--concurrency debe ser un entero positivo.');
                }
                flags.concurrency = Number(value);
                break;
            }
            default:
                if (arg.startsWith('-')) {
                    throw new UsageError(`Opción desconocida: ${arg}`);
                }
                if (flags.envFile) {
                    throw new UsageError(`Argumento inesperado: ${arg}`);
                }
                flags.envFile = arg;
        }
    }

    if (flags.help) {
        return flags;
    }
    if (!flags.envFile) {
        throw new UsageError('Falta el archivo de entorno (p. ej. .env.natura).');
    }
    if (flags.yes && !/^\d{12}$/.test(flags.expectAccount)) {
        throw new UsageError('--yes exige --expect-account <id de cuenta AWS de 12 dígitos>.');
    }
    if (flags.from && flags.only) {
        throw new UsageError('--from y --only son excluyentes.');
    }
    for (const name of [flags.from, flags.only].filter(Boolean)) {
        if (!phaseNames.includes(name)) {
            throw new UsageError(`Fase desconocida: ${name}. Fases: ${phaseNames.join(', ')}`);
        }
    }
    return flags;
}

// Import dinámico: deployConsoleUi engancha handlers de TTY al cargarse y los tests
// de parseArgs/main no deben arrastrarlos.
async function loadRealDeps({ write, interactive }) {
    const aws = await import('./confirmAwsDeployTarget.mjs');
    const ui = await import('./deployConsoleUi.mjs');
    const ask = interactive
        ? ui.createInteractiveAsk({ write })
        : async () => {
              throw new Error('No hay terminal para confirmar: usa --yes --expect-account <id>.');
          };
    return {
        run: runCommand,
        ask,
        identity: (ctx) => ({
            resolve: ({ region, expectedAccount }) =>
                aws.resolveAwsDeployTarget({
                    runSts: aws.createAwsStsRunner(),
                    runAccountName: aws.createAwsAccountNameRunner(),
                    runAccountAliases: aws.createAwsAccountAliasRunner(),
                    region,
                    expectedAccount,
                    name: ctx.env.AWS_ACCOUNT_NAME || '',
                }),
            confirm: (target) =>
                aws.runAwsDeployConfirmation({ target, skipConfirm: ctx.flags.yes, ask: ctx.ask, write: ctx.write }),
        }),
    };
}

export async function main(argv = process.argv.slice(2), injected = null) {
    const write = injected?.write || ((text) => stderr.write(text));
    let flags;
    try {
        flags = parseArgs(argv);
    } catch (error) {
        if (error instanceof UsageError) {
            write(`${error.message}\n${USAGE}`);
            return EXIT.USAGE;
        }
        throw error;
    }
    if (flags.help) {
        write(USAGE);
        return EXIT.OK;
    }

    const rootDir = injected?.rootDir || ROOT_DIR;
    const envFile = path.resolve(process.cwd(), flags.envFile);
    if (!existsSync(envFile)) {
        write(`No existe el archivo de entorno: ${envFile}\n`);
        return EXIT.USAGE;
    }
    const interactive = injected?.interactive ?? Boolean(stdin.isTTY);
    if (!flags.yes && !interactive) {
        write('Sin terminal interactiva hay que pasar --yes --expect-account <id>.\n');
        return EXIT.USAGE;
    }
    const envActivation = injected?.envActivation || createEnvActivation(rootDir, envFile);
    if (envActivation.staleBackup) {
        write(
            'Existe .env.deploy-backup de un despliegue interrumpido. Revísalo y restáuralo con\n' +
                '  node utils/deploy-env/swapDeployEnv.mjs --restore\nantes de volver a desplegar.\n'
        );
        return EXIT.USAGE;
    }

    const deps = injected || (await loadRealDeps({ write, interactive }));
    const ctx = createContext({ rootDir, envFile, flags, run: deps.run, ask: deps.ask, write });
    ctx.envActivation = envActivation;
    ctx.identity = deps.identity(ctx);

    let outcome;
    try {
        outcome = await runPhases(injected?.phases || PHASES, ctx);
    } finally {
        envActivation.restore();
    }

    write(`\n${formatSummary(outcome.results)}\n`);
    if (ctx.envBackup.done) {
        write(`Copia del ${path.basename(envFile)} previa a los cambios: ${ctx.envBackup.path}\n`);
    }
    if (outcome.aborted) {
        return EXIT.ABORTED;
    }
    if (outcome.failure) {
        write(
            `\n✗ ${outcome.failure.name}: ${outcome.failure.error.message}\n${resumeHint(flags.envFile, outcome.failure)}\n`
        );
        return EXIT.FAILED;
    }
    return EXIT.OK;
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked === import.meta.url) {
    // process.exit explícito: el prompt interactivo deja listeners en stdin.
    process.exit(await main());
}
