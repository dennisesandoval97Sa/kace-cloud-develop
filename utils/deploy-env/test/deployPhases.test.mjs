import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrations } from '../phases/migrations.mjs';
import { services } from '../phases/services.mjs';
import { makeCtx } from './helpers.mjs';

describe('migrations', () => {
    it('lanza migrate:latest de @kace/database en streaming y con el .env activo', async () => {
        // Arrange
        const { ctx, calls } = makeCtx();

        // Act
        await migrations.run(ctx);

        // Assert
        assert.equal(calls[0].line, 'pnpm --filter @kace/database run migrate:latest');
        assert.equal(calls[0].opts.stream, true);
        assert.equal(migrations.needsActiveEnv, true);
        assert.equal(migrations.isDone, undefined);
    });

    it('propaga el fallo', async () => {
        // Arrange
        const { ctx } = makeCtx({ routes: [{ match: 'migrate:latest', result: { code: 1 } }] });

        // Act / Assert
        await assert.rejects(migrations.run(ctx), /migraciones terminó con código 1/);
    });
});

describe('services', () => {
    const VALIDATE = 'bash utils/bash/validate-env-deploy.sh';
    const DEPLOY = 'pnpm -r run --workspace-concurrency=5 --report-summary cdk:deploy';
    const CLEAN = 'pnpm -r run cdk:clean';

    it('valida el contrato, despliega todos los paquetes y limpia, en streaming y con el .env activo', async () => {
        // Arrange
        const { ctx, calls } = makeCtx();

        // Act
        await services.run(ctx);

        // Assert
        assert.deepEqual(
            calls.map((call) => call.line),
            [VALIDATE, DEPLOY, CLEAN]
        );
        assert.ok(calls.every((call) => call.opts.stream === true));
        assert.equal(services.needsActiveEnv, true);
    });

    it('pasa --concurrency a --workspace-concurrency', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ flags: { concurrency: 15 } });

        // Act
        await services.run(ctx);

        // Assert
        assert.equal(calls[1].line, 'pnpm -r run --workspace-concurrency=15 --report-summary cdk:deploy');
    });

    it('si el contrato del .env no se cumple no despliega nada', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ routes: [{ match: 'validate-env-deploy.sh', result: { code: 1 } }] });

        // Act / Assert
        await assert.rejects(services.run(ctx), /validate-env-deploy\.sh terminó con código 1/);
        assert.equal(calls.length, 1);
    });

    it('si falla algún cdk:deploy no limpia, para dejar cdk.out a mano', async () => {
        // Arrange
        const { ctx, calls } = makeCtx({ routes: [{ match: 'cdk:deploy', result: { code: 1 } }] });

        // Act / Assert
        await assert.rejects(services.run(ctx), /cdk:deploy terminó con código 1/);
        assert.ok(!calls.some((call) => call.line === CLEAN));
    });
});
