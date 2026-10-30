import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const API_ROOT = path.join(ROOT, 'apps', 'apiv1');
const IGNORED_DIRECTORIES = new Set([
    'node_modules',
    'lib',
    'dist',
    'build',
    '.aws-sam',
    'cdk.out',
    'coverage',
    'test',
    'tests',
    'test-results',
]);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs']);

const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });

    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name)) return [];
            return walk(fullPath);
        }

        if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
        return [fullPath];
    });
};

const normalizePathSeparators = (value) => value.split(path.sep).join('/');

const toKebabCase = (value) =>
    value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/[_\s.]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

const stripControllerAffixes = (value) => {
    const withoutAffixes = value.replace(/^controller-?/, '').replace(/-?controller$/, '');
    return withoutAffixes || value;
};

const isPrimaryControllerPath = (pathParts) => {
    if (pathParts.length !== 2 || pathParts[0] !== 'src') return false;

    const baseName = path.basename(pathParts[1], path.extname(pathParts[1])).toLowerCase();
    return baseName === 'controller' || baseName === 'index';
};

const toEndpointKey = (filePath) => {
    const relative = path.relative(API_ROOT, filePath);
    const [serviceName, ...rest] = relative.split(path.sep);

    // Endpoint keys are deterministic and aligned with SearchPolicyRegistry:
    // 1. Service key = API package directory without kace_cloud_api_, underscores
    //    normalized to hyphens.
    // 2. Primary service controllers (src/controller.*, src/Controller.*,
    //    src/index.*, etc.) map to <service>.search to match semantic registry
    //    entries such as clients.search and cases.search.
    // 3. Secondary controllers append a stable, lowercase kebab-case controller
    //    path with generic Controller affixes removed, then the .search suffix.
    //    Example: src/ControllerSearchByCase.mjs -> event-logs.search-by-case.search.
    const serviceKey = toKebabCase(serviceName.replace(/^kace_cloud_api_/, ''));
    if (isPrimaryControllerPath(rest)) return `${serviceKey}.search`;

    const controllerKey = rest
        .filter((part) => part !== 'src')
        .map((part) => path.basename(part, path.extname(part)))
        .map(toKebabCase)
        .map(stripControllerAffixes)
        .filter(Boolean)
        .join('.');

    return `${serviceKey}.${controllerKey}.search`;
};

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const hasActionSearchHandler = (source) => {
    const uncommentedSource = stripComments(source);
    return (
        /(?:async\s+)?actionSearch\s*\(/.test(uncommentedSource) ||
        /actionSearch\s*=\s*(?:async\s*)?\(/.test(uncommentedSource)
    );
};

const files = existsSync(API_ROOT) && statSync(API_ROOT).isDirectory() ? walk(API_ROOT) : [];
const handlers = files
    .map((filePath) => ({ filePath, source: readFileSync(filePath, 'utf8') }))
    .filter(({ source }) => hasActionSearchHandler(source))
    .map(({ filePath }) => ({
        endpointKey: toEndpointKey(filePath),
        file: normalizePathSeparators(path.relative(ROOT, filePath)),
    }))
    .sort((a, b) => a.endpointKey.localeCompare(b.endpointKey) || a.file.localeCompare(b.file));

// Search branches that live inside an existing actionSearch handler file and
// therefore do not map to their own controller file. Keep in sync with
// SearchPolicyRegistry's defaultSearchEndpointKeys.
const ADDITIONAL_SEARCH_ENDPOINTS = [
    {
        endpointKey: 'interactions.candidate-cases.search',
        file: 'apps/apiv1/kace_cloud_api_interactions/src/ControllerAssociateInteractionToCaso.mjs',
    },
];

const allHandlers = [...handlers, ...ADDITIONAL_SEARCH_ENDPOINTS].sort(
    (a, b) => a.endpointKey.localeCompare(b.endpointKey) || a.file.localeCompare(b.file)
);

console.log(JSON.stringify(allHandlers, null, 2));
