import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const findEnvFile = (startDir) => {
    let dir = startDir;
    while (dir !== dirname(dir)) {
        const envPath = resolve(dir, '.env');
        if (existsSync(envPath)) return envPath;
        dir = dirname(dir);
    }
    return undefined;
};

dotenv.config({ path: findEnvFile(__dirname) });

export const schema = process.env.DB_SCHEMA;
export const serviceName = process.env.APPS_SERVICE_NAME;
