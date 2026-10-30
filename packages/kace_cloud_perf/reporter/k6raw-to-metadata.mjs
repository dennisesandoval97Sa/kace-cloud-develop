import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, dirname, join, resolve } from 'node:path';

// Convierte un raw json de k6 (`--out json=...`) en el metadata.json que espera
// reporter/compare.mjs. Pensado para escenarios sueltos (p.ej. scenarios/cases/count.js)
// que NO pasan por el runner de catálogo y por tanto no generan metadata.json.
//
// Uso:
//   node reporter/k6raw-to-metadata.mjs <raw.json> [--id cases-count] [--phase F1-R] [--endpoint /cases-count]
// Escribe metadata.json junto al raw.json (mismo directorio).

function percentile(sortedAsc, p) {
    if (sortedAsc.length === 0) return null;
    const rank = (p / 100) * (sortedAsc.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) return sortedAsc[lo];
    const frac = rank - lo;
    return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

export function computeMetrics({ durations, reqCount, failedCount, firstTs, lastTs }) {
    durations.sort((a, b) => a - b);
    const elapsedSec = firstTs && lastTs ? (lastTs - firstTs) / 1000 : 0;
    return {
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
        errorRate: reqCount > 0 ? failedCount / reqCount : 0,
        rps: elapsedSec > 0 ? reqCount / elapsedSec : 0,
        reqCount,
    };
}

async function ingestRaw(rawPath) {
    const durations = [];
    let reqCount = 0;
    let failedCount = 0;
    let firstTs = null;
    let lastTs = null;

    const rl = createInterface({ input: createReadStream(rawPath, 'utf8'), crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line || line.charCodeAt(0) !== 123) continue; // fast skip non-'{' lines
        let row;
        try {
            row = JSON.parse(line);
        } catch {
            continue;
        }
        if (row.type !== 'Point') continue;
        const m = row.metric;
        if (m === 'http_req_duration') {
            durations.push(row.data.value);
        } else if (m === 'http_reqs') {
            reqCount += row.data.value;
            const t = Date.parse(row.data.time);
            if (firstTs === null || t < firstTs) firstTs = t;
            if (lastTs === null || t > lastTs) lastTs = t;
        } else if (m === 'http_req_failed') {
            failedCount += row.data.value;
        }
    }
    return computeMetrics({ durations, reqCount, failedCount, firstTs, lastTs });
}

function parseArgs(argv) {
    const args = { id: 'cases-count', phase: 'F1-R', endpoint: '/cases-count', service: 'cases' };
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            args[a.slice(2)] = argv[++i];
        } else {
            positional.push(a);
        }
    }
    args.rawPath = positional[0];
    return args;
}

async function runCli() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.rawPath) {
        console.error('Usage: k6raw-to-metadata.mjs <raw.json> [--id ID] [--phase F1-R] [--endpoint /path]');
        process.exit(1);
    }
    const rawPath = resolve(args.rawPath);
    const outDir = dirname(rawPath);
    const metrics = await ingestRaw(rawPath);

    const metadata = {
        baselineId: basename(outDir),
        phase: args.phase,
        ranAt: new Date().toISOString(),
        ranBy: process.env.USER ?? 'unknown',
        environment: {
            apiBaseUrl: process.env.PERF_API_BASE_URL,
            datasetSnapshot: process.env.PERF_DATASET_SNAPSHOT ?? 'unspecified',
        },
        loadProfile: { source: basename(rawPath) },
        results: [
            {
                id: args.id,
                service: args.service,
                endpoint: args.endpoint,
                status: metrics.errorRate < 0.01 ? 'OK' : 'THRESHOLD_BREACH',
                p50: metrics.p50,
                p95: metrics.p95,
                p99: metrics.p99,
                errorRate: metrics.errorRate,
                rps: metrics.rps,
            },
        ],
    };
    const outPath = join(outDir, 'metadata.json');
    writeFileSync(outPath, JSON.stringify(metadata, null, 4));
    console.error(`Wrote ${outPath}`);
    console.error(
        `  ${args.id}: reqs=${metrics.reqCount} rps=${metrics.rps.toFixed(1)} p50=${metrics.p50?.toFixed(0)}ms p95=${metrics.p95?.toFixed(0)}ms p99=${metrics.p99?.toFixed(0)}ms err=${(metrics.errorRate * 100).toFixed(2)}%`
    );
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
