import { awsJson, isStackMissing, runStreamed } from '../aws.mjs';
import { applyEnvUpdates } from '../context.mjs';
import { mapOutputs, stackName } from '../outputMap.mjs';

export function classifyStackStatus(status) {
    if (!status) {
        return 'missing';
    }
    if (status === 'ROLLBACK_COMPLETE' || status.endsWith('_FAILED')) {
        return 'failed';
    }
    if (status.endsWith('_IN_PROGRESS')) {
        return 'busy';
    }
    return 'ready';
}

export async function describeStack(ctx, name) {
    try {
        const data = await awsJson(ctx, ['cloudformation', 'describe-stacks', '--stack-name', name]);
        const stack = data.Stacks?.[0];
        return stack ? { status: stack.StackStatus, outputs: stack.Outputs || [] } : null;
    } catch (error) {
        if (isStackMissing(error)) {
            return null;
        }
        throw error;
    }
}

export async function assertStackUsable(ctx, name) {
    const stack = await describeStack(ctx, name);
    const state = classifyStackStatus(stack?.status ?? null);
    if (state === 'failed') {
        throw new Error(
            `El stack ${name} está en ${stack.status}. Revísalo en CloudFormation y, si procede, bórralo a mano ` +
                'antes de reintentar: este comando nunca borra stacks.'
        );
    }
    if (state === 'busy') {
        throw new Error(
            `El stack ${name} está en ${stack.status}. Espera a que termine la operación en curso y reintenta.`
        );
    }
    return { stack, state };
}

export function createStackPhase({ name, stackId, command, alwaysDeploy = false }) {
    return {
        name,
        needsActiveEnv: true,
        async isDone(ctx) {
            const { state } = await assertStackUsable(ctx, stackName(ctx.serviceName, stackId));
            return state === 'ready' && !alwaysDeploy;
        },
        async run(ctx) {
            const [cmd, ...args] = command;
            await runStreamed(ctx, cmd, args, name);
        },
        async sync(ctx) {
            const fullName = stackName(ctx.serviceName, stackId);
            const stack = await describeStack(ctx, fullName);
            if (!stack) {
                if (ctx.flags.dryRun) {
                    ctx.write(`  ${fullName} no existe todavía: no hay outputs que sincronizar\n`);
                    return;
                }
                throw new Error(`El stack ${fullName} no existe después del deploy.`);
            }
            const { updates, missing } = mapOutputs(stackId, stack.outputs);
            if (missing.length) {
                throw new Error(
                    `Al stack ${fullName} le faltan outputs: ${missing.join(', ')}. ¿Cambió el stack o outputMap.mjs?`
                );
            }
            applyEnvUpdates(ctx, updates);
        },
    };
}
