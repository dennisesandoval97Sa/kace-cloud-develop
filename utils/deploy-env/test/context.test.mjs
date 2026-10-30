import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyEnvUpdates, createContext, normalizeAnswer, resolveRegion } from '../context.mjs';
import { makeCtx } from './helpers.mjs';

describe('resolveRegion', () => {
    it('prioriza AWS_REGION del proceso, luego AWS_DEFAULT_REGION, luego el .env', () => {
        assert.equal(resolveRegion({ AWS_REGION: 'eu-west-1' }, { AWS_REGION: 'us-east-2' }), 'us-east-2');
        assert.equal(resolveRegion({ AWS_REGION: 'eu-west-1' }, { AWS_DEFAULT_REGION: 'sa-east-1' }), 'sa-east-1');
        assert.equal(resolveRegion({ AWS_REGION: 'eu-west-1' }, {}), 'eu-west-1');
        assert.equal(resolveRegion({}, {}), 'us-east-1');
    });
});

describe('createContext', () => {
    it('carga env, serviceName y región desde el archivo', () => {
        // Arrange / Act
        const { ctx } = makeCtx({ envText: 'APPS_SERVICE_NAME=MULTI\nAWS_REGION=eu-west-1\n' });

        // Assert
        assert.equal(ctx.serviceName, 'MULTI');
        assert.equal(ctx.region, 'eu-west-1');
        assert.equal(ctx.env.APPS_SERVICE_NAME, 'MULTI');
    });

    it('run inyecta cwd, AWS_REGION, AWS_DEFAULT_REGION y AWS_PAGER', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ envText: 'APPS_SERVICE_NAME=S\nAWS_REGION=eu-west-1\n' });

        // Act
        await ctx.run('aws', ['sts'], { stream: true });

        // Assert
        assert.equal(calls[0].opts.cwd, ctx.rootDir);
        assert.equal(calls[0].opts.stream, true);
        assert.equal(calls[0].opts.env.AWS_REGION, 'eu-west-1');
        assert.equal(calls[0].opts.env.AWS_DEFAULT_REGION, 'eu-west-1');
        assert.equal(calls[0].opts.env.AWS_PAGER, '');
    });

    it('confirm normaliza la respuesta del prompt', async () => {
        // Arrange
        const { ctx, asked } = makeCtx({ answers: ['sí'] });

        // Act
        const accepted = await ctx.confirm('¿Seguro?');

        // Assert
        assert.equal(accepted, true);
        assert.equal(asked[0].type, 'confirm');
        assert.equal(asked[0].default, false);
    });
});

describe('normalizeAnswer', () => {
    it('acepta booleanos y s/si/sí/y/yes', () => {
        for (const answer of [true, 's', 'Si', 'sí', 'y', 'YES']) {
            assert.equal(normalizeAnswer(answer), true);
        }
        for (const answer of [false, '', 'n', 'no', undefined]) {
            assert.equal(normalizeAnswer(answer), false);
        }
    });
});

describe('applyEnvUpdates', () => {
    it('escribe, imprime el diff y recarga el contexto', () => {
        // Arrange
        const { ctx, file, output } = makeCtx({ envText: 'APPS_SERVICE_NAME=S\nARN=\n' });

        // Act
        applyEnvUpdates(ctx, { ARN: 'arn:aws:sqs:us-east-1:1:cola' });

        // Assert
        assert.match(readFileSync(file, 'utf8'), /^ARN=arn:aws:sqs:us-east-1:1:cola$/m);
        assert.equal(ctx.env.ARN, 'arn:aws:sqs:us-east-1:1:cola');
        assert.equal(ctx.envBackup.done, true);
        assert.match(output.join(''), /NUEVA {3}ARN = arn:…cola/);
    });

    it('en dry-run imprime pero no escribe ni recarga', () => {
        // Arrange
        const { ctx, file } = makeCtx({ envText: 'APPS_SERVICE_NAME=S\nARN=\n', flags: { dryRun: true } });

        // Act
        applyEnvUpdates(ctx, { ARN: 'x-valor-largo' });

        // Assert
        assert.equal(readFileSync(file, 'utf8'), 'APPS_SERVICE_NAME=S\nARN=\n');
        assert.equal(ctx.env.ARN, '');
    });
});

describe('createContext sleep', () => {
    it('usa el sleep inyectado', async () => {
        // Arrange
        const dir = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-test-'));
        const envFile = path.join(dir, '.env.test');
        writeFileSync(envFile, 'APPS_SERVICE_NAME=svc\n');
        const slept = [];
        const ctx = createContext({
            rootDir: dir,
            envFile,
            flags: {},
            run: async () => ({ code: 0, stdout: '', stderr: '' }),
            ask: async () => false,
            write: () => {},
            sleep: async (ms) => slept.push(ms),
        });

        // Act
        await ctx.sleep(5);

        // Assert
        assert.deepEqual(slept, [5]);
    });
});
