import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EXIT, main, parseArgs, PHASES } from '../deployEnvironment.mjs';
import { AbortedError, UsageError } from '../errors.mjs';
import { createFakeRun } from './helpers.mjs';

describe('PHASES', () => {
    it('tiene las 10 fases en el orden del spec', () => {
        assert.deepEqual(
            PHASES.map((phase) => phase.name),
            [
                'preflight',
                'cdk-bootstrap',
                'infra-stack',
                'tenant-stack',
                'event-processor-stack',
                'db-proxy-secrets',
                'migrations',
                'services',
                'cognito-client',
                'tenant-registration',
            ]
        );
    });
});

describe('parseArgs', () => {
    it('acepta el -- inicial de pnpm y todos los flags', () => {
        // Act
        const flags = parseArgs([
            '--',
            '.env.natura',
            '--yes',
            '--expect-account',
            '706409443078',
            '--from',
            'services',
            '--dry-run',
            '--overwrite-tenant',
            '--concurrency',
            '15',
        ]);

        // Assert
        assert.deepEqual(flags, {
            envFile: '.env.natura',
            yes: true,
            expectAccount: '706409443078',
            from: 'services',
            only: '',
            dryRun: true,
            overwriteTenant: true,
            concurrency: 15,
            help: false,
        });
    });

    const invalid = [
        [[], /Falta el archivo de entorno/],
        [['.env.a', '.env.b'], /Argumento inesperado: .env.b/],
        [['.env.a', '--nope'], /Opción desconocida: --nope/],
        [['.env.a', '--yes'], /--yes exige --expect-account/],
        [['.env.a', '--yes', '--expect-account', '123'], /--yes exige --expect-account/],
        [['.env.a', '--from', 'a', '--only', 'b'], /excluyentes/],
        [['.env.a', '--from', 'inexistente'], /Fase desconocida: inexistente/],
        [['.env.a', '--from'], /--from necesita un valor/],
        [['.env.a', '--concurrency', '0'], /entero positivo/],
    ];
    for (const [argv, message] of invalid) {
        it(`rechaza ${JSON.stringify(argv)}`, () => {
            assert.throws(
                () => parseArgs(argv),
                (error) => error instanceof UsageError && message.test(error.message)
            );
        });
    }

    it('--help no exige archivo', () => {
        assert.equal(parseArgs(['--help']).help, true);
    });
});

describe('main', () => {
    function setup({ phases, interactive = true, staleBackup = false, envText = 'APPS_SERVICE_NAME=S\n' } = {}) {
        const rootDir = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-main-'));
        const envFile = path.join(rootDir, '.env.test');
        writeFileSync(envFile, envText);
        const output = [];
        const activation = {
            staleBackup,
            restored: 0,
            activate() {},
            restore() {
                this.restored += 1;
            },
        };
        const injected = {
            rootDir,
            run: createFakeRun().run,
            ask: async () => true,
            write: (text) => output.push(text),
            interactive,
            envActivation: activation,
            identity: () => ({ resolve: async () => ({ ok: true, account: '1' }), confirm: async () => true }),
            phases,
        };
        return { injected, envFile, output, activation };
    }
    const phase = (name, run = async () => {}) => ({ name, run });

    it('devuelve 0, imprime el resumen y restaura el .env', async () => {
        // Arrange
        const { injected, envFile, output, activation } = setup({ phases: [phase('a')] });

        // Act
        const code = await main([envFile], injected);

        // Assert
        assert.equal(code, EXIT.OK);
        assert.match(output.join(''), /Resumen:\n {2}a {2}ejecutado/);
        assert.equal(activation.restored, 1);
    });

    it('devuelve 1 con el error y la pista de reanudar', async () => {
        // Arrange
        const { injected, envFile, output, activation } = setup({
            phases: [
                phase('a', async () => {
                    throw new Error('boom');
                }),
            ],
        });

        // Act
        const code = await main([envFile], injected);

        // Assert
        assert.equal(code, EXIT.FAILED);
        assert.match(output.join(''), /✗ a: boom/);
        assert.match(output.join(''), new RegExp(`Reanudar: pnpm run deploy:env -- ${envFile} --from a`));
        assert.equal(activation.restored, 1);
    });

    it('devuelve 4 si se aborta', async () => {
        // Arrange
        const { injected, envFile } = setup({
            phases: [
                phase('a', async () => {
                    throw new AbortedError('no');
                }),
            ],
        });

        // Act / Assert
        assert.equal(await main([envFile], injected), EXIT.ABORTED);
    });

    it('devuelve 2 con flags inválidos, sin tocar el .env', async () => {
        // Arrange
        const { injected, activation } = setup({ phases: [phase('a')] });

        // Act
        const code = await main(['--nope'], injected);

        // Assert
        assert.equal(code, EXIT.USAGE);
        assert.equal(activation.restored, 0);
    });

    it('devuelve 2 si el archivo no existe', async () => {
        // Arrange
        const { injected } = setup({ phases: [phase('a')] });

        // Act / Assert
        assert.equal(await main(['/no/existe/.env.x'], injected), EXIT.USAGE);
    });

    it('devuelve 2 sin TTY y sin --yes', async () => {
        // Arrange
        const { injected, envFile, output } = setup({ phases: [phase('a')], interactive: false });

        // Act
        const code = await main([envFile], injected);

        // Assert
        assert.equal(code, EXIT.USAGE);
        assert.match(output.join(''), /--yes --expect-account/);
    });

    it('devuelve 2 si hay un .env.deploy-backup huérfano', async () => {
        // Arrange
        const { injected, envFile, output } = setup({ phases: [phase('a')], staleBackup: true });

        // Act
        const code = await main([envFile], injected);

        // Assert
        assert.equal(code, EXIT.USAGE);
        assert.match(output.join(''), /\.env\.deploy-backup/);
    });
});
