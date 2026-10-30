import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AbortedError } from '../errors.mjs';
import { findMissingKeys, preflight, readContractKeys } from '../phases/preflight.mjs';
import { makeCtx } from './helpers.mjs';

const EXAMPLE = [
    'APPS_SERVICE_NAME=',
    'DB_HOST=',
    '# COMENTADA=',
    'AWS_CASES_EVENTS_QUEUE_ARN=',
    'VITE_TENANT_ID=',
    'DB_HOST=',
].join('\n');

function ctxWith({ envText, flags = {}, identity = {} }) {
    const made = makeCtx({ envText, flags, files: { '.env.example': EXAMPLE } });
    made.confirms = [];
    made.ctx.identity = {
        resolve: identity.resolve || (async () => ({ ok: true, account: '123456789012' })),
        confirm: async (target) => {
            made.confirms.push(target);
            return identity.accept ?? true;
        },
    };
    return made;
}

describe('readContractKeys / findMissingKeys', () => {
    it('lee claves no comentadas sin duplicados', () => {
        assert.deepEqual(readContractKeys(EXAMPLE), [
            'APPS_SERVICE_NAME',
            'DB_HOST',
            'AWS_CASES_EVENTS_QUEUE_ARN',
            'VITE_TENANT_ID',
        ]);
    });

    it('excluye las claves derivadas y las del id del tenant; una clave vacía cuenta como presente', () => {
        // Arrange
        const keys = readContractKeys(EXAMPLE);

        // Act
        const missing = findMissingKeys(keys, { APPS_SERVICE_NAME: 'S' });
        const none = findMissingKeys(keys, { APPS_SERVICE_NAME: 'S', DB_HOST: '' });

        // Assert
        assert.deepEqual(missing, ['DB_HOST']);
        assert.deepEqual(none, []);
    });
});

describe('preflight', () => {
    const OK_ENV = 'APPS_SERVICE_NAME=S\nDB_HOST=h\nVITE_TENANT_ID=11111111-1111-4111-8111-111111111111\n';

    it('falla listando las claves no derivadas que faltan', async () => {
        // Arrange
        const { ctx } = ctxWith({ envText: 'APPS_SERVICE_NAME=S\n' });

        // Act / Assert
        await assert.rejects(preflight.run(ctx), /Faltan 1 variable\(s\)[\s\S]*- DB_HOST/);
    });

    it('falla si APPS_SERVICE_NAME está vacío', async () => {
        // Arrange
        const { ctx } = ctxWith({ envText: 'APPS_SERVICE_NAME=\nDB_HOST=h\n' });

        // Act / Assert
        await assert.rejects(preflight.run(ctx), /APPS_SERVICE_NAME está vacío/);
    });

    it('falla con el mensaje de identidad si no hay credenciales', async () => {
        // Arrange
        const { ctx } = ctxWith({
            envText: OK_ENV,
            identity: { resolve: async () => ({ ok: false, message: 'Credenciales vencidas' }) },
        });

        // Act / Assert
        await assert.rejects(preflight.run(ctx), /Credenciales vencidas/);
    });

    it('falla si la cuenta no es la de --expect-account', async () => {
        // Arrange
        const { ctx } = ctxWith({ envText: OK_ENV, flags: { yes: true, expectAccount: '999999999999' } });

        // Act / Assert
        await assert.rejects(preflight.run(ctx), /123456789012.*no es la esperada.*999999999999/);
    });

    it('lanza AbortedError si el operador no confirma', async () => {
        // Arrange
        const { ctx } = ctxWith({ envText: OK_ENV, identity: { accept: false } });

        // Act / Assert
        await assert.rejects(preflight.run(ctx), AbortedError);
    });

    it('confirma, guarda la cuenta e instala dependencias', async () => {
        // Arrange
        const { ctx, calls, confirms } = ctxWith({ envText: OK_ENV });

        // Act
        await preflight.run(ctx);

        // Assert
        assert.equal(confirms.length, 1);
        assert.equal(ctx.account, '123456789012');
        assert.equal(calls.at(-1).line, 'pnpm install --frozen-lockfile');
        assert.equal(calls.at(-1).opts.stream, true);
    });

    it('genera y persiste VITE_TENANT_ID si no hay id', async () => {
        // Arrange
        const { ctx, file } = ctxWith({ envText: 'APPS_SERVICE_NAME=S\nDB_HOST=h\nVITE_TENANT_ID=\n' });

        // Act
        await preflight.run(ctx);

        // Assert
        assert.match(ctx.env.VITE_TENANT_ID, /^[0-9a-f-]{36}$/);
        assert.match(readFileSync(file, 'utf8'), new RegExp(`^VITE_TENANT_ID=${ctx.env.VITE_TENANT_ID}$`, 'm'));
    });

    it('no toca el id si ya existe TENANT_ID', async () => {
        // Arrange
        const envText = 'APPS_SERVICE_NAME=S\nDB_HOST=h\nTENANT_ID=abc\n';
        const { ctx, file } = ctxWith({ envText });

        // Act
        await preflight.run(ctx);

        // Assert
        assert.equal(readFileSync(file, 'utf8'), envText);
    });

    it('en dry-run no pide confirmación, no instala ni escribe', async () => {
        // Arrange
        const envText = 'APPS_SERVICE_NAME=S\nDB_HOST=h\n';
        const { ctx, calls, confirms, file } = ctxWith({ envText, flags: { dryRun: true } });

        // Act
        await preflight.run(ctx);

        // Assert
        assert.equal(confirms.length, 0);
        assert.equal(calls.length, 0);
        assert.equal(readFileSync(file, 'utf8'), envText);
        assert.equal(preflight.always, true);
    });
});
