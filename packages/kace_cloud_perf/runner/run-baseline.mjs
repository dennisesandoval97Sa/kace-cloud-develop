import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve absolute roots from the location of this file, not from cwd.
// This file lives at <PACKAGE_ROOT>/runner/run-baseline.mjs.
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');

// Token refresh threshold for inter-scenario refresh: tokens with less than this
// remaining are renewed before the next scenario starts. 30min covers any 10min
// scenario plus its warmup with comfortable margin against Cognito clock skew.
const INTER_SCENARIO_REFRESH_THRESHOLD_MS = 30 * 60 * 1000;

// Two-tier load profile retry thresholds: if the first run at the catalog RPS
// breaches either of these, the runner retries the scenario at a lower RPS to
// capture a usable baseline instead of just FAILED/THRESHOLD_BREACH noise.
const RETRY_ERROR_RATE_THRESHOLD = 0.05;
const RETRY_P95_MS_THRESHOLD = 4000;

export function shouldRetryAtLowerRps(result) {
    const errorRate = result?.errorRate ?? 0;
    const p95 = result?.p95 ?? 0;
    return errorRate > RETRY_ERROR_RATE_THRESHOLD || p95 > RETRY_P95_MS_THRESHOLD;
}

// Maps catalog.phase like "F1-R" / "F2-R" / "F4-W" to a directory slug
// like "f1-read" / "f2-read" / "f4-write". Falls back to "f1-read" for safety
// when phase is malformed or missing.
export function phaseToOutDirSlug(phase) {
    const match = typeof phase === 'string' ? phase.match(/^F(\d+)-([RW])$/) : null;
    if (!match) return 'f1-read';
    const [, round, kind] = match;
    return `f${round}-${kind === 'R' ? 'read' : 'write'}`;
}

export function shouldSkipCompletedScenario(paths) {
    if (!existsSync(paths.summaryJson)) return false;
    try {
        JSON.parse(readFileSync(paths.summaryJson, 'utf8'));
        return true;
    } catch {
        return false;
    }
}

export function classifyPreflightResult(results) {
    const failing = results.filter((r) => r.status < 200 || r.status >= 300);
    if (failing.length === 0) return { verdict: 'OK', failing: [] };
    const has5xx = failing.some((r) => r.status >= 500);
    return { verdict: has5xx ? 'ENV_ERROR' : 'GAPS_FOUND', failing };
}

export function buildRefreshCommand(packageRoot, thresholdMs = INTER_SCENARIO_REFRESH_THRESHOLD_MS) {
    return {
        command: 'node',
        args: [resolve(packageRoot, 'auth/refresh-tokens.mjs')],
        env: { ...process.env, PERF_TOKEN_REFRESH_THRESHOLD_MS: String(thresholdMs) },
        cwd: packageRoot,
    };
}

export function classifyResult({ exitCode, summary }) {
    if (exitCode !== 0) {
        return 'FAILED';
    }
    if (!summary) {
        return 'OK';
    }
    for (const metric of Object.values(summary.metrics ?? {})) {
        for (const t of Object.values(metric.thresholds ?? {})) {
            // k6 summary-export: bare boolean (true=crossed) en versiones nuevas, { ok: false } en viejas.
            const crossed = typeof t === 'boolean' ? t : t?.ok === false;
            if (crossed) {
                return 'THRESHOLD_BREACH';
            }
        }
    }
    return 'OK';
}

export function buildOutputPaths(outDir, scenarioId) {
    return {
        outDir,
        rawDir: join(outDir, 'raw'),
        rawJson: join(outDir, 'raw', `${scenarioId}.json`),
        summaryJson: join(outDir, 'raw', `${scenarioId}.summary.json`),
    };
}

export function parseSummary(summary) {
    // k6 cambió el shape del summary-export entre versiones:
    // - Nuevo (v0.50+): { http_req_duration: { med, "p(95)", ... }, http_req_failed: { value: 0..1, passes, fails } }
    // - Viejo: { http_req_duration: { values: { "p(50)", "p(95)", ... } }, http_req_failed: { values: { rate } } }
    // Soportamos ambos cayendo a `metric` si no existe `metric.values`.
    const durRoot = summary.metrics?.http_req_duration ?? {};
    const dur = durRoot.values ?? durRoot;
    const failedRoot = summary.metrics?.http_req_failed ?? {};
    const failed = failedRoot.values ?? failedRoot;
    const reqsRoot = summary.metrics?.http_reqs ?? {};
    const reqs = reqsRoot.values ?? reqsRoot;
    return {
        p50: dur['p(50)'] ?? dur.med,
        p95: dur['p(95)'],
        p99: dur['p(99)'],
        errorRate: failed.rate ?? failed.value ?? 0,
        rps: reqs.rate ?? 0,
    };
}

function runRefreshTokens() {
    return new Promise((resolvePromise) => {
        const cmd = buildRefreshCommand(PACKAGE_ROOT);
        const child = spawn(cmd.command, cmd.args, {
            env: cmd.env,
            cwd: cmd.cwd,
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`  WARN: token refresh exited with code ${code}, continuing`);
            }
            resolvePromise(code ?? 0);
        });
    });
}

function runK6(script, paths, envOverride = {}) {
    return new Promise((resolvePromise) => {
        mkdirSync(paths.rawDir, { recursive: true });
        const args = ['run', '--out', `json=${paths.rawJson}`, '--summary-export', paths.summaryJson, script];
        const child = spawn('k6', args, {
            env: { ...process.env, ...envOverride },
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        child.on('close', (code) => resolvePromise(code ?? 1));
    });
}

async function runPreflight(scenario, endpointsDir, idPoolsDir, tokensPath) {
    const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
    const token = tokens[0]?.idToken;
    if (!token) return { id: scenario.id, status: 0, error: 'no token available' };

    const endpointFile = join(endpointsDir, `${scenario.service}.json`);
    if (!existsSync(endpointFile)) return { id: scenario.id, status: 0, error: 'no endpoint catalog' };

    const catalog = JSON.parse(readFileSync(endpointFile, 'utf8'));
    const endpoint = catalog.endpoints.find((e) => e.id === scenario.endpointId);
    if (!endpoint) return { id: scenario.id, status: 0, error: `endpoint ${scenario.endpointId} not in catalog` };

    let url = `${process.env.PERF_API_BASE_URL}${endpoint.path}`;
    if (endpoint.requiresId) {
        const idPoolFile = join(idPoolsDir, `${scenario.idTable ?? scenario.service}.local.json`);
        if (!existsSync(idPoolFile)) return { id: scenario.id, status: 0, error: 'no id pool' };
        const ids = JSON.parse(readFileSync(idPoolFile, 'utf8'));
        url = url.replace('{id}', ids[0]);
    }

    const init = {
        method: endpoint.method,
        headers: {
            Accept: 'application/json',
            'X-Tenant-Id': process.env.PERF_TENANT_ID,
            Authorization: token,
            'x-client-fingerprint': process.env.PERF_CLIENT_FINGERPRINT ?? '2292838579',
        },
    };
    if (endpoint.method === 'POST' && endpoint.body) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(endpoint.body);
    }

    try {
        const res = await fetch(url, init);
        return { id: scenario.id, status: res.status, url };
    } catch (err) {
        return { id: scenario.id, status: 0, error: err.message };
    }
}

async function runAllPreflights(catalog, packageRoot) {
    const endpointsDir = join(packageRoot, 'runner', 'endpoints');
    const idPoolsDir = join(packageRoot, 'data', 'data-pool');
    const tokensPath = join(packageRoot, 'auth', 'tokens.local.json');

    const results = [];
    for (const scenario of catalog.scenarios) {
        const r = await runPreflight(scenario, endpointsDir, idPoolsDir, tokensPath);
        console.error(`  preflight ${scenario.id}: ${r.status || 'NETWORK_ERR'}${r.error ? ` (${r.error})` : ''}`);
        results.push(r);
    }
    return results;
}

async function runScenario(scenario, outDir, envOverride = {}) {
    const paths = buildOutputPaths(outDir, scenario.id);

    if (shouldSkipCompletedScenario(paths)) {
        console.error(`  ${scenario.id}: skipping (summary already exists)`);
        const summary = JSON.parse(readFileSync(paths.summaryJson, 'utf8'));
        const status = classifyResult({ exitCode: 0, summary });
        return { ...scenario, status, ...parseSummary(summary) };
    }

    const script = resolve(PACKAGE_ROOT, scenario.script);
    const exitCode = await runK6(script, paths, envOverride);
    let summary = null;
    try {
        summary = JSON.parse(readFileSync(paths.summaryJson, 'utf8'));
    } catch (err) {
        // summary may be missing if k6 crashed early; classifyResult handles it.
    }
    const status = classifyResult({ exitCode, summary });
    const metrics = summary ? parseSummary(summary) : {};
    return { ...scenario, status, ...metrics };
}

async function runCli() {
    // Catalog path se resuelve relativo a cwd (es un argumento que el usuario teclea).
    const catalogArg = process.argv[2] ?? 'runner/catalog/phase1-read.json';
    const catalogPath = resolve(catalogArg);

    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

    // Output dir por defecto: <REPO_ROOT>/docs/perf/baselines/<fecha>-<phaseSlug>
    // El slug se deriva de catalog.phase (F1-R → f1-read, F2-R → f2-read, F4-W → f4-write).
    const dateSlug = new Date().toISOString().slice(0, 10);
    const phaseSlug = phaseToOutDirSlug(catalog.phase);
    const defaultOutDir = join(REPO_ROOT, 'docs', 'perf', 'baselines', `${dateSlug}-${phaseSlug}`);
    const outDir = resolve(process.argv[3] ?? defaultOutDir);

    mkdirSync(outDir, { recursive: true });
    console.error(`Running ${catalog.scenarios.length} scenarios for ${catalog.phase}`);
    console.error(`  package root: ${PACKAGE_ROOT}`);
    console.error(`  output dir:   ${outDir}`);

    console.error(`\n=== Refreshing tokens before pre-flight ===`);
    await runRefreshTokens();

    console.error(`\n=== Pre-flight check (${catalog.scenarios.length} scenarios) ===`);
    const preflights = await runAllPreflights(catalog, PACKAGE_ROOT);
    const verdict = classifyPreflightResult(preflights);

    if (verdict.verdict !== 'OK') {
        console.error(`\nPre-flight ${verdict.verdict}. Failing scenarios:`);
        for (const f of verdict.failing) {
            console.error(`  ${f.id}: status=${f.status} ${f.error ?? ''}`);
        }
        console.error('\nResolve gaps before retrying. Aborting.');
        process.exit(1);
    }
    console.error('Pre-flight OK. Starting full run...\n');

    const results = [];
    for (const scenario of catalog.scenarios) {
        console.error(`\n=== ${scenario.id} (${scenario.endpoint}) ===`);
        await runRefreshTokens();
        const result = await runScenario(scenario, outDir);
        console.error(`  status=${result.status} p95=${result.p95 ?? 'n/a'}ms errorRate=${result.errorRate ?? 'n/a'}`);
        results.push(result);

        if (shouldRetryAtLowerRps(result)) {
            console.error(`  saturated → retrying at 10 RPS...`);
            const retryResult = await runScenario({ ...scenario, id: `${scenario.id}-retry-10rps` }, outDir, {
                PERF_RPS: '10',
                PERF_WARMUP_RPS: '5',
            });
            console.error(
                `  retry: status=${retryResult.status} p95=${retryResult.p95 ?? 'n/a'}ms errorRate=${retryResult.errorRate ?? 'n/a'}`
            );
            results.push(retryResult);
        }
    }

    const metadata = {
        baselineId: outDir.split('/').pop(),
        phase: catalog.phase,
        ranAt: new Date().toISOString(),
        ranBy: process.env.USER ?? 'unknown',
        environment: {
            apiBaseUrl: process.env.PERF_API_BASE_URL,
            datasetSnapshot: process.env.PERF_DATASET_SNAPSHOT ?? 'unspecified',
        },
        loadProfile: {
            rps: Number(process.env.PERF_RPS ?? 50),
            duration: process.env.PERF_DURATION ?? '10m',
            warmupRps: Number(process.env.PERF_WARMUP_RPS ?? 10),
            warmup: process.env.PERF_WARMUP ?? '30s',
        },
        results,
    };
    writeFileSync(join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 4));
    console.error(`\nWrote metadata to ${join(outDir, 'metadata.json')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
