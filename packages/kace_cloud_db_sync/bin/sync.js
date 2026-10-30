import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import knexLib from 'knex';
import dotenv from 'dotenv';
import { validateSyncConfig } from '../src/config/sync-config-schema.js';
import { buildConnectionsFromEnv } from '../src/config/env-config-provider.js';
import { TableSyncService } from '../src/application/table-sync-service.js';
import { enableJsonPassthrough } from '../src/infrastructure/json-passthrough.js';
import { logInfo, logError } from '../src/shared/logger.js';

// El .env vive en la raíz del monorepo, como en el resto de paquetes. Resuelto contra la
// ubicación de este archivo y no contra process.cwd(), para que funcione desde cualquier
// directorio: dotenv no lanza si el archivo falta, así que un path errado no da error, sólo
// deja las variables sin cargar y produce un "Missing environment variables" engañoso.
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

// Debe llamarse antes de crear cualquier instancia de Knex: node-postgres registra los parsers
// de tipo de forma global por proceso, y las conexiones ya abiertas no los recogen retroactivamente.
enableJsonPassthrough();

const loadConfig = async (path) => {
    const contents = await readFile(path, 'utf8');

    return validateSyncConfig(JSON.parse(contents));
};

const main = async () => {
    const { values } = parseArgs({
        options: { config: { type: 'string', short: 'c', default: 'tables.config.json' } },
    });

    const config = await loadConfig(resolve(process.cwd(), values.config));
    const connections = buildConnectionsFromEnv(config);
    const sourceKnex = knexLib(connections.source);
    const targetKnex = knexLib(connections.target);

    try {
        logInfo(
            `Sincronizando ${config.tables.length} tabla(s): ${config.source.database}.${config.source.schema} → ${config.target.database}.${config.target.schema}`
        );

        const service = new TableSyncService({ sourceKnex, targetKnex });
        const report = await service.sync(config);

        for (const line of report.toLines()) {
            logInfo(line);
        }

        return report.hasFailures ? 1 : 0;
    } finally {
        await sourceKnex.destroy();
        await targetKnex.destroy();
    }
};

try {
    process.exitCode = await main();
} catch (error) {
    logError(`Fallo fatal: ${error.message}`);
    process.exitCode = 1;
}
