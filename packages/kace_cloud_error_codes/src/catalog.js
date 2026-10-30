import * as general from './catalog/general.js';
import * as validation from './catalog/validation.js';
import * as database from './catalog/database.js';
import * as http from './catalog/http.js';
import * as integrations from './catalog/integrations.js';
import * as auth from './catalog/auth.js';
import * as authorization from './catalog/authorization.js';
import * as queues from './catalog/queues.js';
import * as files from './catalog/files.js';
import * as tenant from './catalog/tenant.js';

export function assembleCatalog(modules) {
    const catalog = {};
    const seenCodes = new Set();

    for (const moduleExports of modules) {
        for (const [name, code] of Object.entries(moduleExports)) {
            if (Object.hasOwn(catalog, name)) {
                throw new Error(`Duplicate public error code name: ${name}`);
            }
            if (seenCodes.has(code)) {
                throw new Error(`Duplicate public error code value: ${code}`);
            }
            catalog[name] = code;
            seenCodes.add(code);
        }
    }

    return Object.freeze(catalog);
}

export const PUBLIC_ERROR_CODES = assembleCatalog([
    general,
    validation,
    database,
    http,
    integrations,
    auth,
    authorization,
    queues,
    files,
    tenant,
]);

export const PUBLIC_ERROR_CODE_ENTRIES = Object.freeze(
    Object.entries(PUBLIC_ERROR_CODES).map(([name, code]) => Object.freeze({ name, code }))
);

export const PUBLIC_ERROR_CODE_NAMES_BY_CODE = Object.freeze(
    PUBLIC_ERROR_CODE_ENTRIES.reduce((acc, { name, code }) => {
        acc[code] = name;
        return acc;
    }, {})
);
