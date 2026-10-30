import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function renderHtml(metadata) {
    const safeJson = JSON.stringify(metadata).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Baseline ${metadata.baselineId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 2rem; }
        table { border-collapse: collapse; margin-bottom: 2rem; }
        th, td { border: 1px solid #ccc; padding: 0.4rem 0.8rem; text-align: left; }
        th { background: #f4f4f4; }
        .status-OK { color: #0a7d28; }
        .status-THRESHOLD_BREACH { color: #c08400; }
        .status-FAILED { color: #c0392b; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Baseline ${metadata.baselineId}</h1>
    <p><b>Phase:</b> ${metadata.phase} &middot; <b>Ran at:</b> ${metadata.ranAt}</p>
    <p><b>Load:</b> ${metadata.loadProfile.rps} RPS &times; ${metadata.loadProfile.duration} (warmup ${metadata.loadProfile.warmup})</p>
    <p><b>Env:</b> ${metadata.environment?.apiBaseUrl ?? 'unknown'}</p>
    <div id="content"></div>
    <script>
        const data = ${safeJson};
        const root = document.getElementById('content');
        const groups = new Map();
        for (const r of data.results) {
            if (!groups.has(r.service)) groups.set(r.service, []);
            groups.get(r.service).push(r);
        }
        for (const [service, scenarios] of groups) {
            const h = document.createElement('h2');
            h.textContent = service;
            root.appendChild(h);
            const t = document.createElement('table');
            t.innerHTML = '<thead><tr><th>Endpoint</th><th>RPS</th><th>p50</th><th>p95</th><th>p99</th><th>Error rate</th><th>Status</th></tr></thead>';
            const tb = document.createElement('tbody');
            for (const s of scenarios) {
                const row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + s.endpoint + '</td>' +
                    '<td>' + (s.rps?.toFixed(1) ?? 'n/a') + '</td>' +
                    '<td>' + (s.p50?.toFixed(1) ?? 'n/a') + 'ms</td>' +
                    '<td>' + (s.p95?.toFixed(1) ?? 'n/a') + 'ms</td>' +
                    '<td>' + (s.p99?.toFixed(1) ?? 'n/a') + 'ms</td>' +
                    '<td>' + ((s.errorRate ?? 0) * 100).toFixed(2) + '%</td>' +
                    '<td class="status-' + s.status + '">' + s.status + '</td>';
                tb.appendChild(row);
            }
            t.appendChild(tb);
            root.appendChild(t);
        }
    </script>
</body>
</html>`;
}

async function runCli() {
    const baselineDir = process.argv[2];
    if (!baselineDir) {
        console.error('Usage: render-html.mjs <baseline-dir>');
        process.exit(1);
    }
    const metadata = JSON.parse(readFileSync(join(baselineDir, 'metadata.json'), 'utf8'));
    const html = renderHtml(metadata);
    const outPath = join(baselineDir, 'summary.html');
    writeFileSync(outPath, html);
    console.error(`Wrote ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
