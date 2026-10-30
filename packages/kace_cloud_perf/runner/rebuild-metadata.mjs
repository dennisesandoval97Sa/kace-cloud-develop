// Rebuilds metadata.json for a baseline directory by re-reading every
// raw/<scenario-id>.summary.json that exists. Useful when a partial re-run has
// overwritten metadata.json (the runner currently emits metadata only for the
// scenarios in the catalog passed in).
//
// Usage:
//   node --env-file=.env.perf runner/rebuild-metadata.mjs <baseline-dir> <catalog-path>
//
// The catalog provides scenario metadata (service, endpoint, mutating, script);
// the summary files provide measured metrics. Scenarios in the catalog without
// a matching summary file are reported with status=MISSING.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { buildOutputPaths, classifyResult, parseSummary } from './run-baseline.mjs';

export function aggregateSubCatalogs(masterCatalog, catalogDir, subLoader) {
    if (!masterCatalog.subCatalogs?.length) return [];

    const byId = new Map();
    for (const subPath of masterCatalog.subCatalogs) {
        const sub = subLoader(join(catalogDir, subPath));
        if (!sub) continue;
        for (const scenario of sub.scenarios ?? []) {
            byId.set(scenario.id, scenario);
        }
    }
    return [...byId.values()];
}

function rebuildResult(scenario, outDir) {
    const paths = buildOutputPaths(outDir, scenario.id);
    if (!existsSync(paths.summaryJson)) {
        return { ...scenario, status: 'MISSING' };
    }
    const summary = JSON.parse(readFileSync(paths.summaryJson, 'utf8'));
    // We don't have the original exitCode after the fact, so we treat presence
    // of a summary as exitCode=0 and rely solely on threshold inspection.
    const status = classifyResult({ exitCode: 0, summary });
    return { ...scenario, status, ...parseSummary(summary) };
}

async function runCli() {
    const baselineDir = resolve(process.argv[2]);
    const catalogPath = resolve(process.argv[3]);
    if (!baselineDir || !catalogPath) {
        console.error('Usage: rebuild-metadata.mjs <baseline-dir> <catalog-path>');
        process.exit(1);
    }

    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

    let scenarios;
    if (catalog.subCatalogs?.length) {
        const catalogDir = dirname(catalogPath);
        scenarios = aggregateSubCatalogs(catalog, catalogDir, (p) => JSON.parse(readFileSync(p, 'utf8')));
    } else {
        scenarios = catalog.scenarios;
    }

    const results = scenarios.map((s) => rebuildResult(s, baselineDir));

    const existingPath = join(baselineDir, 'metadata.json');
    const existing = existsSync(existingPath) ? JSON.parse(readFileSync(existingPath, 'utf8')) : {};

    const metadata = {
        baselineId: existing.baselineId ?? baselineDir.split('/').pop(),
        phase: catalog.phase,
        ranAt: existing.ranAt ?? new Date().toISOString(),
        rebuiltAt: new Date().toISOString(),
        ranBy: existing.ranBy ?? process.env.USER ?? 'unknown',
        environment: existing.environment ?? {
            apiBaseUrl: process.env.PERF_API_BASE_URL,
            datasetSnapshot: process.env.PERF_DATASET_SNAPSHOT ?? 'unspecified',
        },
        loadProfile: existing.loadProfile ?? {
            rps: Number(process.env.PERF_RPS ?? 50),
            duration: process.env.PERF_DURATION ?? '10m',
            warmupRps: Number(process.env.PERF_WARMUP_RPS ?? 10),
            warmup: process.env.PERF_WARMUP ?? '30s',
        },
        results,
    };

    writeFileSync(existingPath, JSON.stringify(metadata, null, 4));
    console.error(`Rebuilt metadata.json with ${results.length} scenarios`);
    for (const r of results) {
        console.error(`  ${r.id}: status=${r.status} p95=${r.p95 ?? 'n/a'}ms errorRate=${r.errorRate ?? 'n/a'}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
