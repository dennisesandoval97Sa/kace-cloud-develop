import { runStreamed } from '../aws.mjs';

// Sin isDone: knex migrate:latest ya es idempotente. env-config.js de @kace/database
// lee el .env de la raíz, por eso necesita el entorno activo.
export const migrations = {
    name: 'migrations',
    needsActiveEnv: true,
    async run(ctx) {
        await runStreamed(ctx, 'pnpm', ['--filter', '@kace/database', 'run', 'migrate:latest'], 'migraciones');
    },
};
