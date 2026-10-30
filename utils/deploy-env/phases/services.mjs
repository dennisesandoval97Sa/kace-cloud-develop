import { runStreamed } from '../aws.mjs';

// Igual que `pnpm deploy`.
const DEFAULT_CONCURRENCY = 5;

// El flujo que Seguridad mantiene en el repo (`pnpm deploy` / `deploy:15`): contrato completo
// del .env, cdk:deploy de todos los paquetes que lo tienen y cdk:clean solo si todo se desplegó
// (el mismo `&&` del package.json). `pnpm install` ya corrió en preflight.
export const services = {
    name: 'services',
    needsActiveEnv: true,
    async run(ctx) {
        const concurrency = ctx.flags.concurrency || DEFAULT_CONCURRENCY;
        await runStreamed(ctx, 'bash', ['utils/bash/validate-env-deploy.sh'], 'validate-env-deploy.sh');
        await runStreamed(
            ctx,
            'pnpm',
            ['-r', 'run', `--workspace-concurrency=${concurrency}`, '--report-summary', 'cdk:deploy'],
            'cdk:deploy'
        );
        await runStreamed(ctx, 'pnpm', ['-r', 'run', 'cdk:clean'], 'cdk:clean');
    },
};
