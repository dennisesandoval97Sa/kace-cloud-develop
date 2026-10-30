import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../../../..');

const apiRoot = path.join(repoRoot, 'apps/apiv1');
const scannedRoots = [
    ...readdirSync(apiRoot)
        .map((entry) => path.join(apiRoot, entry, 'src'))
        .filter((entryPath) => existsSync(entryPath)),
    path.join(repoRoot, 'packages/kace_cloud_api_common/src'),
];

const allowedManualSerializers = new Set([
    'apps/apiv1/kace_cloud_api_event_processor/src/shared/normalizeRecords.mjs',
    'packages/kace_cloud_api_common/src/http_responses/Response.js',
]);

function toPosix(relativePath) {
    return relativePath.split(path.sep).join('/');
}

function walkFiles(dir) {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir).flatMap((entry) => {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === 'cdk.out' || entry === 'coverage') {
                return [];
            }

            return walkFiles(fullPath);
        }

        return stat.isFile() && /\.(mjs|js)$/.test(entry) ? [fullPath] : [];
    });
}

describe('public error bypass scan', () => {
    it('keeps public API HTTP responses on the shared Response serializer', () => {
        const manualSerializers = scannedRoots
            .flatMap(walkFiles)
            .map((filePath) => {
                const relativePath = toPosix(path.relative(repoRoot, filePath));
                return {
                    relativePath,
                    source: readFileSync(filePath, 'utf8'),
                };
            })
            .filter(({ relativePath, source }) => {
                return source.includes('body: JSON.stringify') && !allowedManualSerializers.has(relativePath);
            })
            .map(({ relativePath }) => relativePath);

        expect(manualSerializers).toEqual([]);
    });
});
