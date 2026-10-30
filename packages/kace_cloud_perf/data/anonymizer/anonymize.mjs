import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { applyTransformer } from './transformers.mjs';

export function buildRuleIndex(manifest) {
    const index = new Map();
    for (const rule of manifest.rules) {
        if (!index.has(rule.table)) {
            index.set(rule.table, []);
        }
        index.get(rule.table).push(rule);
    }
    return index;
}

export function applyRulesToRow(tableName, row, ruleIndex) {
    const rules = ruleIndex.get(tableName);
    if (!rules) {
        return row;
    }
    const result = { ...row };
    for (const rule of rules) {
        if (rule.column in result) {
            result[rule.column] = applyTransformer(rule.transformer, result[rule.column]);
        }
    }
    return result;
}

export function loadManifest(path) {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw);
}

const COPY_END_MARKER = '\\.';

export function rewriteCopyLine(tableName, columns, line, ruleIndex) {
    if (line === COPY_END_MARKER) {
        return line;
    }
    const rules = ruleIndex.get(tableName);
    if (!rules) {
        return line;
    }
    const fields = line.split('\t');
    if (fields.length !== columns.length) {
        return line;
    }
    for (const rule of rules) {
        const idx = columns.indexOf(rule.column);
        if (idx === -1) {
            continue;
        }
        fields[idx] = applyTransformer(rule.transformer, fields[idx]);
    }
    return fields.join('\t');
}

async function runCli() {
    const manifestPath = process.env.PII_MANIFEST_PATH ?? './data/manifests/pii-fields.json';
    const manifest = loadManifest(manifestPath);
    if (!manifest.approvedBy?.approvedAt) {
        console.error('Refusing to run: pii-fields.json has not been approved by DBA + legal.');
        process.exit(1);
    }
    const ruleIndex = buildRuleIndex(manifest);
    const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });

    let currentTable = null;
    let currentColumns = null;
    const COPY_HEADER_RE = /^COPY\s+(?:public\.)?(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin/i;

    for await (const line of reader) {
        if (currentTable === null) {
            const match = line.match(COPY_HEADER_RE);
            if (match) {
                currentTable = match[1];
                currentColumns = match[2].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
            }
            process.stdout.write(`${line}\n`);
            continue;
        }
        if (line === '\\.') {
            process.stdout.write(`${line}\n`);
            currentTable = null;
            currentColumns = null;
            continue;
        }
        const rewritten = rewriteCopyLine(currentTable, currentColumns, line, ruleIndex);
        process.stdout.write(`${rewritten}\n`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await runCli();
}
