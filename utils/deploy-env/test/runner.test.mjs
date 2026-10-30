import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AbortedError } from '../errors.mjs';
import { formatSummary, resumeHint, runPhases, STATUS } from '../runner.mjs';
import { makeCtx } from './helpers.mjs';

function spyPhase(name, { done = false, fail = null, warning = null, always = false, needsActiveEnv = false } = {}) {
    const log = [];
    return {
        log,
        phase: {
            name,
            always,
            needsActiveEnv,
            async isDone() {
                log.push('isDone');
                return done;
            },
            async run() {
                log.push('run');
                if (fail) {
                    throw fail;
                }
                return warning ? { warning } : undefined;
            },
            async sync() {
                log.push('sync');
            },
        },
    };
}

function planPhase({ done = false } = {}) {
    const log = [];
    return {
        log,
        phase: {
            name: 'p',
            async isDone() {
                return done;
            },
            async plan() {
                log.push('plan');
                return ['linea 1', 'linea 2'];
            },
            async run() {
                log.push('run');
            },
        },
    };
}

describe('runPhases plan', () => {
    it('en dry-run y no hecha llama a plan y escribe sus líneas indentadas', async () => {
        // Arrange
        const p = planPhase();
        const { ctx, output } = makeCtx({ flags: { dryRun: true } });

        // Act
        const outcome = await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, ['plan']);
        assert.equal(outcome.results[0].status, STATUS.WOULD_RUN);
        assert.ok(output.join('').includes('  linea 1\n  linea 2\n'));
    });

    it('en dry-run y hecha no llama a plan', async () => {
        // Arrange
        const p = planPhase({ done: true });
        const { ctx } = makeCtx({ flags: { dryRun: true } });

        // Act
        await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, []);
    });

    it('fuera de dry-run nunca llama a plan', async () => {
        // Arrange
        const p = planPhase();
        const { ctx } = makeCtx();

        // Act
        await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, ['run']);
    });

    it('una fase sin plan funciona en dry-run', async () => {
        // Arrange
        const a = spyPhase('a');
        const { ctx } = makeCtx({ flags: { dryRun: true } });

        // Act
        const outcome = await runPhases([a.phase], ctx);

        // Assert
        assert.equal(outcome.results[0].status, STATUS.WOULD_RUN);
    });
});

describe('runPhases', () => {
    it('ejecuta run si no está hecho y siempre sync; salta run si está hecho', async () => {
        // Arrange
        const pending = spyPhase('a');
        const done = spyPhase('b', { done: true });
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([pending.phase, done.phase], ctx);

        // Assert
        assert.deepEqual(pending.log, ['isDone', 'run', 'sync']);
        assert.deepEqual(done.log, ['isDone', 'sync']);
        assert.deepEqual(
            outcome.results.map((r) => r.status),
            [STATUS.RAN, STATUS.DONE]
        );
        assert.equal(outcome.failure, null);
    });

    it('--from salta las anteriores salvo las always', async () => {
        // Arrange
        const pre = spyPhase('preflight', { always: true });
        const a = spyPhase('a');
        const b = spyPhase('b');
        const { ctx } = makeCtx({ flags: { from: 'b' } });

        // Act
        const outcome = await runPhases([pre.phase, a.phase, b.phase], ctx);

        // Assert
        assert.deepEqual(pre.log, ['run', 'sync']);
        assert.deepEqual(a.log, []);
        assert.deepEqual(
            outcome.results.map((r) => r.status),
            [STATUS.RAN, STATUS.SKIPPED, STATUS.RAN]
        );
    });

    it('--only ejecuta solo esa fase (y las always)', async () => {
        // Arrange
        const pre = spyPhase('preflight', { always: true });
        const a = spyPhase('a');
        const b = spyPhase('b');
        const { ctx } = makeCtx({ flags: { only: 'a' } });

        // Act
        const outcome = await runPhases([pre.phase, a.phase, b.phase], ctx);

        // Assert
        assert.deepEqual(
            outcome.results.map((r) => r.status),
            [STATUS.RAN, STATUS.RAN, STATUS.SKIPPED]
        );
    });

    it('en dry-run no llama a run de fases normales pero sí a sync y a run de always', async () => {
        // Arrange
        const pre = spyPhase('preflight', { always: true });
        const a = spyPhase('a', { needsActiveEnv: true });
        const { ctx } = makeCtx({ flags: { dryRun: true } });

        // Act
        const outcome = await runPhases([pre.phase, a.phase], ctx);

        // Assert
        assert.deepEqual(pre.log, ['run', 'sync']);
        assert.deepEqual(a.log, ['isDone', 'sync']);
        assert.equal(outcome.results[1].status, STATUS.WOULD_RUN);
        assert.equal(ctx.envActivation.activations, 0);
    });

    it('activa el .env antes de cada fase needsActiveEnv', async () => {
        // Arrange
        const a = spyPhase('a', { needsActiveEnv: true });
        const b = spyPhase('b');
        const c = spyPhase('c', { needsActiveEnv: true });
        const { ctx } = makeCtx();

        // Act
        await runPhases([a.phase, b.phase, c.phase], ctx);

        // Assert
        assert.equal(ctx.envActivation.activations, 2);
    });

    it('se detiene en el primer fallo y marca el resto como pendiente', async () => {
        // Arrange
        const a = spyPhase('a', { fail: new Error('boom') });
        const b = spyPhase('b');
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([a.phase, b.phase], ctx);

        // Assert
        assert.equal(outcome.failure.name, 'a');
        assert.equal(outcome.failure.error.message, 'boom');
        assert.deepEqual(b.log, []);
        assert.deepEqual(
            outcome.results.map((r) => r.status),
            [STATUS.FAILED, STATUS.PENDING]
        );
    });

    it('un AbortedError marca aborted y no failure', async () => {
        // Arrange
        const a = spyPhase('a', { fail: new AbortedError('no') });
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([a.phase], ctx);

        // Assert
        assert.equal(outcome.aborted, true);
        assert.equal(outcome.failure, null);
        assert.equal(outcome.results[0].status, STATUS.ABORTED);
    });

    it('un run que devuelve warning deja la fase en aviso', async () => {
        // Arrange
        const a = spyPhase('a', { warning: 'ojo' });
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([a.phase], ctx);

        // Assert
        assert.deepEqual(outcome.results[0], { name: 'a', status: STATUS.WARNING, message: 'ojo' });
    });
});

describe('formatSummary / resumeHint', () => {
    it('lista cada fase con su estado y los mensajes de aviso', () => {
        // Act
        const text = formatSummary([
            { name: 'preflight', status: STATUS.RAN },
            { name: 'tenant-registration', status: STATUS.WARNING, message: 'ojo' },
        ]);

        // Assert
        assert.equal(text, 'Resumen:\n  preflight            ejecutado\n  tenant-registration  aviso — ojo');
    });

    it('sugiere reanudar desde la fase que falló', () => {
        assert.equal(
            resumeHint('.env.natura', { name: 'services' }),
            'Reanudar: pnpm run deploy:env -- .env.natura --from services'
        );
    });
});

function appliesPhase({ applies }) {
    const log = [];
    return {
        log,
        phase: {
            name: 'p',
            async applies() {
                log.push('applies');
                return applies;
            },
            async isDone() {
                log.push('isDone');
                return false;
            },
            async plan() {
                log.push('plan');
                return ['linea'];
            },
            async run() {
                log.push('run');
            },
            async sync() {
                log.push('sync');
            },
        },
    };
}

describe('runPhases applies', () => {
    it('applies falso → no aplica sin llamar a isDone, run ni sync', async () => {
        // Arrange
        const p = appliesPhase({ applies: false });
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, ['applies']);
        assert.equal(outcome.results[0].status, STATUS.NOT_APPLICABLE);
        assert.equal(outcome.failure, null);
    });

    it('applies falso en dry-run → no aplica sin llamar a plan', async () => {
        // Arrange
        const p = appliesPhase({ applies: false });
        const { ctx, output } = makeCtx({ flags: { dryRun: true } });

        // Act
        const outcome = await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, ['applies']);
        assert.equal(outcome.results[0].status, STATUS.NOT_APPLICABLE);
        assert.ok(!output.join('').includes('linea'));
    });

    it('applies verdadero → flujo normal', async () => {
        // Arrange
        const p = appliesPhase({ applies: true });
        const { ctx } = makeCtx();

        // Act
        const outcome = await runPhases([p.phase], ctx);

        // Assert
        assert.deepEqual(p.log, ['applies', 'isDone', 'run', 'sync']);
        assert.equal(outcome.results[0].status, STATUS.RAN);
    });

    it('el valor de NOT_APPLICABLE es "no aplica"', () => {
        // Arrange / Act / Assert
        assert.equal(STATUS.NOT_APPLICABLE, 'no aplica');
    });
});
