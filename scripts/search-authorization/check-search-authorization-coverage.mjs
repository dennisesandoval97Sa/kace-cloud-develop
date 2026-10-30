import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const INVENTORY_PATH = path.join(SCRIPT_DIR, 'inventory-search-handlers.mjs');
const REGISTRY_PATH = path.join(
    ROOT,
    'packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js'
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripJavaScriptComments = (source) => {
    let result = '';
    let state = 'code';
    let escaped = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];

        if (state === 'lineComment') {
            if (char === '\n' || char === '\r') {
                result += char;
                state = 'code';
            }
            continue;
        }

        if (state === 'blockComment') {
            if (char === '*' && next === '/') {
                index += 1;
                state = 'code';
            } else if (char === '\n' || char === '\r') {
                result += char;
            }
            continue;
        }

        if (state === 'code') {
            if (char === '/' && next === '/') {
                state = 'lineComment';
                index += 1;
                continue;
            }

            if (char === '/' && next === '*') {
                state = 'blockComment';
                index += 1;
                continue;
            }

            result += char;

            if (char === "'" || char === '"' || char === '`') {
                state = char;
                escaped = false;
            }
            continue;
        }

        result += char;

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === state) {
            state = 'code';
        }
    }

    return result;
};

const inventory = spawnSync(process.execPath, [INVENTORY_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
});

if (inventory.status !== 0) {
    console.error('Failed to generate search handler inventory.');
    if (inventory.stderr) console.error(inventory.stderr.trim());
    process.exit(inventory.status ?? 1);
}

let handlers;
try {
    handlers = JSON.parse(inventory.stdout);
} catch (error) {
    console.error('Search handler inventory did not produce valid JSON.');
    console.error(error.message);
    process.exit(1);
}

const { searchPolicies } = await import(pathToFileURL(REGISTRY_PATH).href);
const registeredEndpointKeys = new Set(searchPolicies.map(({ endpointKey }) => endpointKey));
const missingPolicies = [];
const missingEnforcement = [];

const hasAuthorizeSearchCall = (source, endpointKey) => {
    const endpointLiteral = `(['"])${escapeRegExp(endpointKey)}\\1`;
    const authorizeSearchPattern = new RegExp(`(?:this\\.)?#authorizeSearch\\s*\\(\\s*${endpointLiteral}`);
    const serviceAuthorizePattern = new RegExp(
        `\\.authorize\\s*\\(\\s*\\{[\\s\\S]*?endpointKey\\s*:\\s*${endpointLiteral}[\\s\\S]*?\\}\\s*\\)`
    );

    return authorizeSearchPattern.test(source) || serviceAuthorizePattern.test(source);
};

for (const handler of handlers) {
    if (!registeredEndpointKeys.has(handler.endpointKey)) {
        missingPolicies.push(handler.endpointKey);
    }

    const source = stripJavaScriptComments(readFileSync(path.join(ROOT, handler.file), 'utf8'));
    if (!hasAuthorizeSearchCall(source, handler.endpointKey)) {
        missingEnforcement.push(`${handler.endpointKey} (${handler.file})`);
    }
}

if (missingPolicies.length > 0 || missingEnforcement.length > 0) {
    console.error(`Search authorization coverage incomplete for ${handlers.length} discovered handlers.`);

    if (missingPolicies.length > 0) {
        console.error(`\nMissing search policies (${missingPolicies.length}):`);
        missingPolicies.forEach((item) => console.error(`- ${item}`));
    }

    if (missingEnforcement.length > 0) {
        console.error(`\nMissing search enforcement calls (${missingEnforcement.length}):`);
        missingEnforcement.forEach((item) => console.error(`- ${item}`));
    }

    process.exit(1);
}

console.log(`Search authorization coverage OK for ${handlers.length} handlers.`);
