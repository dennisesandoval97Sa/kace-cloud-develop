import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function groupByService(results) {
    const map = new Map();
    for (const r of results) {
        if (!map.has(r.service)) {
            map.set(r.service, []);
        }
        map.get(r.service).push(r);
    }
    return map;
}

function fmt(value, suffix = '') {
    if (value === undefined || value === null || Number.isNaN(value)) return 'n/a';
    if (typeof value !== 'number') return String(value);
    return `${value.toFixed(suffix === '%' ? 2 : 1)}${suffix}`;
}

export function renderMarkdown(metadata) {
    const lines = [];
    lines.push(`# Baseline ${metadata.baselineId}`);
    lines.push('');
    lines.push(`Phase: **${metadata.phase}** | Run at: ${metadata.ranAt}`);
    lines.push(
        `Load: ${metadata.loadProfile.rps} RPS x ${metadata.loadProfile.duration} (warmup ${metadata.loadProfile.warmup})`
    );
    lines.push(`Env: ${metadata.environment.apiBaseUrl ?? 'unknown'}`);
    lines.push('');

    const grouped = groupByService(metadata.results);
    for (const [service, scenarios] of grouped) {
        lines.push(`## ${service}`);
        lines.push('');
        lines.push('| Endpoint | RPS | p50 | p95 | p99 | Error rate | Status |');
        lines.push('|---|---|---|---|---|---|---|');
        for (const s of scenarios) {
            lines.push(
                `| ${s.id} (${s.endpoint}) | ${fmt(s.rps)} | ${fmt(s.p50, 'ms')} | ${fmt(s.p95, 'ms')} | ${fmt(s.p99, 'ms')} | ${fmt((s.errorRate ?? 0) * 100, '%')} | ${s.status} |`
            );
        }
        lines.push('');
    }
    return lines.join('\n');
}

async function runCli() {
    const baselineDir = process.argv[2];
    if (!baselineDir) {
        console.error('Usage: summarize.mjs <baseline-dir>');
        process.exit(1);
    }
    const metadataPath = join(baselineDir, 'metadata.json');
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    const md = renderMarkdown(metadata);
    const outPath = join(baselineDir, 'summary.md');
    writeFileSync(outPath, md);
    console.error(`Wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
