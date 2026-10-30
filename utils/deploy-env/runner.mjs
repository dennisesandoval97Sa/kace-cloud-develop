import { AbortedError } from './errors.mjs';

export const STATUS = Object.freeze({
    DONE: 'hecho',
    RAN: 'ejecutado',
    SKIPPED: 'saltado',
    NOT_APPLICABLE: 'no aplica',
    WOULD_RUN: 'se ejecutaría',
    WARNING: 'aviso',
    FAILED: 'falló',
    ABORTED: 'abortado',
    PENDING: 'pendiente',
});

function outcomeStatus(outcome) {
    return outcome?.warning ? { status: STATUS.WARNING, message: outcome.warning } : { status: STATUS.RAN };
}

/**
 * Contrato de fase: { name, always?, needsActiveEnv?, applies?(ctx), isDone?(ctx), run(ctx), sync?(ctx), plan?(ctx) }.
 * `applies` es opcional: si devuelve false la fase queda en `no aplica` y no se llama a nada más.
 * `plan` es opcional: solo se llama en --dry-run cuando la fase NO está hecha y devuelve
 * las líneas (string[]) que detallan qué cambiaría `run`.
 */
async function executePhase(phase, ctx) {
    if (phase.applies && !(await phase.applies(ctx))) {
        return { status: STATUS.NOT_APPLICABLE };
    }
    let result;
    if (phase.always) {
        result = outcomeStatus(await phase.run(ctx));
    } else if (phase.isDone && (await phase.isDone(ctx))) {
        result = { status: STATUS.DONE };
    } else if (ctx.flags.dryRun) {
        if (phase.plan) {
            for (const line of await phase.plan(ctx)) {
                ctx.write(`  ${line}\n`);
            }
        }
        result = { status: STATUS.WOULD_RUN };
    } else {
        result = outcomeStatus(await phase.run(ctx));
    }
    if (phase.sync) {
        await phase.sync(ctx);
    }
    return result;
}

function isSelected(phase, index, names, flags) {
    if (phase.always) {
        return true;
    }
    if (flags.only) {
        return phase.name === flags.only;
    }
    return !flags.from || index >= names.indexOf(flags.from);
}

export async function runPhases(phases, ctx) {
    const names = phases.map((phase) => phase.name);
    const results = [];
    let failure = null;
    let aborted = false;

    for (const [index, phase] of phases.entries()) {
        if (failure || aborted) {
            results.push({ name: phase.name, status: STATUS.PENDING });
            continue;
        }
        if (!isSelected(phase, index, names, ctx.flags)) {
            results.push({ name: phase.name, status: STATUS.SKIPPED });
            continue;
        }
        ctx.write(`\n▶ ${phase.name}\n`);
        try {
            if (phase.needsActiveEnv && !ctx.flags.dryRun) {
                ctx.envActivation.activate();
            }
            results.push({ name: phase.name, ...(await executePhase(phase, ctx)) });
        } catch (error) {
            if (error instanceof AbortedError) {
                aborted = true;
                results.push({ name: phase.name, status: STATUS.ABORTED, message: error.message });
            } else {
                failure = { name: phase.name, error };
                results.push({ name: phase.name, status: STATUS.FAILED });
            }
        }
    }
    return { results, failure, aborted };
}

export function formatSummary(results) {
    const width = Math.max(...results.map((result) => result.name.length)) + 2;
    const lines = results.map(
        (result) => `  ${result.name.padEnd(width)}${result.status}${result.message ? ` — ${result.message}` : ''}`
    );
    return ['Resumen:', ...lines].join('\n');
}

export function resumeHint(envFileArg, failure) {
    return `Reanudar: pnpm run deploy:env -- ${envFileArg} --from ${failure.name}`;
}
