import { runStreamed } from '../aws.mjs';
import { assertStackUsable } from './stackPhase.mjs';

export const cdkBootstrap = {
    name: 'cdk-bootstrap',
    needsActiveEnv: true,
    async isDone(ctx) {
        const { state } = await assertStackUsable(ctx, 'CDKToolkit');
        return state === 'ready';
    },
    async run(ctx) {
        await runStreamed(ctx, 'pnpm', ['--filter', '@kace/aws-infra', 'exec', 'cdk', 'bootstrap'], 'cdk bootstrap');
    },
};
