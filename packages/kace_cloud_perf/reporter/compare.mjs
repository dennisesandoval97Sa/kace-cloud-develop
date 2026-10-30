import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const DRIFT_THRESHOLD_PCT = 10;

export function computeDelta(a, b) {
    if (a === 0 && b === 0) return 0;
    if (a === 0) return Infinity;
    return ((b - a) / a) * 100;
}

function classifyVerdict(deltaP95, deltaErr) {
    if (Math.abs(deltaP95) > DRIFT_THRESHOLD_PCT) return 'drift';
    if (Math.abs(deltaErr) > DRIFT_THRESHOLD_PCT) return 'drift';
    return 'stable';
}

export function compareResults(metadataA, metadataB) {
    const aById = new Map(metadataA.results.map((r) => [r.id, r]));
    const bById = new Map(metadataB.results.map((r) => [r.id, r]));

    const common = [];
    for (const [id, a] of aById) {
        const b = bById.get(id);
        if (!b) continue;
        const deltaP95 = computeDelta(a.p95, b.p95);
        const deltaErr = computeDelta(a.errorRate * 100, b.errorRate * 100);
        common.push({ id, a, b, deltaP95, deltaErr, verdict: classifyVerdict(deltaP95, deltaErr) });
    }

    return {
        commonEndpoints: common,
        onlyInA: [...aById.keys()].filter((id) => !bById.has(id)),
        onlyInB: [...bById.keys()].filter((id) => !aById.has(id)),
    };
}

function renderMarkdown(comparison, baselineAId, baselineBId) {
    const lines = [
        `# Comparación ${baselineAId} vs ${baselineBId}`,
        '',
        '## Endpoints comunes',
        '',
        '| Endpoint | p95 A | p95 B | Δ% | err% A | err% B | Verdict |',
        '|---|---:|---:|---:|---:|---:|:--|',
    ];
    for (const e of comparison.commonEndpoints) {
        lines.push(
            `| ${e.id} | ${e.a.p95?.toFixed(0)} | ${e.b.p95?.toFixed(0)} | ${e.deltaP95.toFixed(1)}% | ${(e.a.errorRate * 100).toFixed(2)}% | ${(e.b.errorRate * 100).toFixed(2)}% | ${e.verdict === 'drift' ? '🚨 drift' : '✓ stable'} |`
        );
    }
    if (comparison.onlyInA.length) {
        lines.push('', `## Solo en ${baselineAId}`, '', ...comparison.onlyInA.map((id) => `- ${id}`));
    }
    if (comparison.onlyInB.length) {
        lines.push('', `## Solo en ${baselineBId}`, '', ...comparison.onlyInB.map((id) => `- ${id}`));
    }
    return lines.join('\n') + '\n';
}

async function runCli() {
    const [baselineADir, baselineBDir] = process.argv.slice(2).map((p) => resolve(p));
    if (!baselineADir || !baselineBDir) {
        console.error('Usage: compare.mjs <baseline-a-dir> <baseline-b-dir>');
        process.exit(1);
    }

    const a = JSON.parse(readFileSync(join(baselineADir, 'metadata.json'), 'utf8'));
    const b = JSON.parse(readFileSync(join(baselineBDir, 'metadata.json'), 'utf8'));
    const comparison = compareResults(a, b);

    const aId = basename(baselineADir);
    const bId = basename(baselineBDir);
    const out = join(baselineBDir, `comparison-vs-${aId}.md`);
    writeFileSync(out, renderMarkdown(comparison, aId, bId));
    console.error(`Wrote ${out}`);

    const drifts = comparison.commonEndpoints.filter((e) => e.verdict === 'drift');
    if (drifts.length) {
        console.error(`\n⚠ ${drifts.length} endpoint(s) with drift > ±10%:`);
        for (const d of drifts) {
            console.error(`  ${d.id}: p95 Δ${d.deltaP95.toFixed(1)}%`);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
