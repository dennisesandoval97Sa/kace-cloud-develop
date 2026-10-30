import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve absolute roots from the location of this file, not from cwd.
// This file lives at <PACKAGE_ROOT>/runner/generate-scenarios.mjs.
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Service → table (for view-by-id pickId). Real table names verified via pre-flight.
const SERVICE_TO_TABLE = {
    cases: 'cases',
    'case-attachments': 'case_attachments',
    'cases-count': 'cases',
    'cases-count-by-group': 'cases',
    users: 'usuarios',
    auxiliaries: 'auxiliares',
    'aux-cases': 'aux_cases',
    'aux-definitions': 'aux_definitions',
    boards: 'boards',
    'one-script': 'one-script',
    schemas: 'schemas',
    classifications: 'clasificaciones',
    states: 'estados',
    group: 'grupos',
    transitions: 'transiciones',
    'case-available-states': 'cases',
};

function tableForService(service) {
    return SERVICE_TO_TABLE[service] ?? service;
}

export function selectTemplate(endpoint) {
    if (endpoint.method === 'GET' && endpoint.requiresId) return 'view-by-id';
    if (endpoint.method === 'GET') return 'view-list';
    if (endpoint.method === 'POST' && /\/(view\/)?search$/.test(endpoint.path)) return 'search';
    return null;
}

const TEMPLATES = {
    'view-list': ({ endpoint }) => `import { get } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

export default function () {
    get('${endpoint.path}');
}
`,

    'view-by-id': ({ endpoint, table }) => {
        if (!table) throw new Error('table is required for view-by-id template');
        return `import { get } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';
import { loadIds, pickRandom } from '../_shared/data-pool.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const IDS = loadIds('${table}');

export default function () {
    const id = pickRandom(IDS);
    get('${endpoint.path}'.replace('{id}', id));
}
`;
    },

    search: ({ endpoint }) => `import { post } from '../_shared/http.js';
import { withWarmup, DEFAULT_OPTIONS } from '../_shared/thresholds.js';

export const options = withWarmup(DEFAULT_OPTIONS);

const SEARCH_BODY = ${JSON.stringify(endpoint.body ?? {}, null, 4)};

export default function () {
    post('${endpoint.path}', SEARCH_BODY);
}
`,
};

export function renderScenario({ template, endpoint, table }) {
    const fn = TEMPLATES[template];
    if (!fn) throw new Error(`Unknown template: ${template}`);
    return fn({ endpoint, table });
}

async function runCli() {
    const args = Object.fromEntries(
        process.argv.slice(2).reduce((acc, arg, i, all) => {
            if (arg.startsWith('--')) acc.push([arg.slice(2), all[i + 1]]);
            return acc;
        }, [])
    );

    const endpointsDir = resolve(args['endpoints-dir'] ?? join(PACKAGE_ROOT, 'runner/endpoints'));
    const scenariosDir = resolve(args['scenarios-dir'] ?? join(PACKAGE_ROOT, 'scenarios'));

    const files = readdirSync(endpointsDir).filter((f) => f.endsWith('.json'));
    let totalScenarios = 0;

    for (const file of files) {
        const catalog = JSON.parse(readFileSync(join(endpointsDir, file), 'utf8'));
        const serviceDir = join(scenariosDir, catalog.service);
        mkdirSync(serviceDir, { recursive: true });

        for (const endpoint of catalog.endpoints) {
            const template = selectTemplate(endpoint);
            if (!template) {
                console.error(`  skip ${catalog.service}/${endpoint.id}: no template`);
                continue;
            }
            const code = renderScenario({
                template,
                endpoint,
                table: template === 'view-by-id' ? tableForService(catalog.service) : undefined,
            });
            const out = join(serviceDir, `${endpoint.id}.js`);
            writeFileSync(out, code);
            console.error(`  ${catalog.service}/${endpoint.id} → ${out}`);
            totalScenarios++;
        }
    }
    console.error(`\nGenerated ${totalScenarios} scenarios.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
