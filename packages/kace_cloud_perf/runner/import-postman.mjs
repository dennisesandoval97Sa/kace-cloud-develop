import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve absolute roots from the location of this file, not from cwd.
// This file lives at <PACKAGE_ROOT>/runner/import-postman.mjs.
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const POSTMAN_BASE_VARS = ['{{baseUrl}}', '{{baseUrlmx}}', '{{G_DOMAIN}}'];

export function normalizePostmanUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return null;
    }
    let url = rawUrl;
    let stripped = false;
    for (const prefix of POSTMAN_BASE_VARS) {
        if (url.startsWith(prefix)) {
            url = url.slice(prefix.length);
            stripped = true;
            break;
        }
    }
    if (!stripped) {
        return null;
    }
    const normalized = url.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, '{$1}');

    // The runner's pre-flight + scenario templates only know how to substitute
    // a single `{id}` placeholder. Reject any URL whose path contains other
    // placeholders (`{entity}`, `{entidad}`, `{responableId}`, `{groupId}`, etc.)
    // so we never generate scenarios that would hit literal `{...}` URLs at
    // load time.
    const placeholders = normalized.match(/\{[^}]+\}/g) ?? [];
    if (!placeholders.every((p) => p === '{id}')) {
        return null;
    }

    return normalized;
}

function deriveEndpointId(method, path) {
    if (method === 'POST' && /\/(view\/)?search$/.test(path)) return 'search';
    if (method !== 'GET') return null;

    const segments = path.split('/').filter(Boolean);
    const idIdx = segments.indexOf('{id}');

    if (idIdx === -1) {
        // view-list. Suffix from all segments after the first (service prefix).
        const tail = segments.slice(1);
        return tail.length === 0 ? 'view-list' : `view-list-${tail.join('-')}`;
    }

    // view-by-id. Suffix from segments after {id}.
    const tail = segments.slice(idIdx + 1);
    return tail.length === 0 ? 'view-by-id' : `view-by-id-${tail.join('-')}`;
}

export function extractEndpointFromRequest(request) {
    const r = request?.request;
    if (!r) return null;

    const method = r.method;
    if (method !== 'GET' && method !== 'POST') return null;

    const path = normalizePostmanUrl(r.url?.raw);
    if (!path) return null;

    const id = deriveEndpointId(method, path);
    if (!id) return null;

    const requiresId = path.includes('{id}');
    const result = { id, method, path, requiresId };

    if (method === 'POST' && r.body?.raw) {
        try {
            result.body = JSON.parse(r.body.raw);
        } catch {
            return null;
        }
    }

    return result;
}

export function groupByService(collection, mapping) {
    const folderToService = new Map();
    for (const [service, folders] of Object.entries(mapping)) {
        const list = Array.isArray(folders) ? folders : [folders];
        for (const folder of list) {
            folderToService.set(folder, service);
        }
    }

    const result = {};
    for (const folder of collection.item ?? []) {
        const service = folderToService.get(folder.name);
        if (!service) continue;

        const endpoints = (folder.item ?? []).map(extractEndpointFromRequest).filter((e) => e !== null);

        if (!result[service]) result[service] = [];
        result[service].push(...endpoints);
    }

    return result;
}

async function runCli() {
    const args = Object.fromEntries(
        process.argv.slice(2).reduce((acc, arg, i, all) => {
            if (arg.startsWith('--')) acc.push([arg.slice(2), all[i + 1]]);
            return acc;
        }, [])
    );

    if (!args.collection) {
        console.error('Usage: import-postman.mjs --collection <path> [--services-config <path>] [--out <dir>]');
        process.exit(1);
    }

    const collectionPath = resolve(args.collection);
    const mappingPath = resolve(args['services-config'] ?? join(PACKAGE_ROOT, 'runner/services-mapping.json'));
    const outDir = resolve(args.out ?? join(PACKAGE_ROOT, 'runner/endpoints'));

    const collection = JSON.parse(readFileSync(collectionPath, 'utf8'));
    const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
    const grouped = groupByService(collection, mapping);

    mkdirSync(outDir, { recursive: true });
    let totalEndpoints = 0;
    for (const [service, endpoints] of Object.entries(grouped)) {
        const folderName = mapping[service];
        const file = join(outDir, `${service}.json`);
        writeFileSync(file, JSON.stringify({ service, postmanFolder: folderName, endpoints }, null, 4));
        console.error(`  ${service}: ${endpoints.length} endpoints → ${file}`);
        totalEndpoints += endpoints.length;
    }
    console.error(`\nWrote ${Object.keys(grouped).length} services, ${totalEndpoints} endpoints total.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
