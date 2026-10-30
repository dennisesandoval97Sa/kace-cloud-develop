#!/usr/bin/env node
//
// Tarea 13: reescribe los imports relativos que apuntan a los directorios de
// tests/ que rename-contexts.sh acaba de mover.
//
// Solo toca el segmento de ruta que coincide EXACTAMENTE con un nombre de
// directorio viejo (nunca una subcadena), para no corromper rutas como
// tests/cases, tests/mail-accounts, tests/allowed-conections, etc. que
// comparten prefijo con los nombres que sí cambian.
//
// Se ejecuta DESPUÉS de rename-contexts.sh (aunque en la práctica no importa
// el orden en disco: lo único relevante es reescribir el texto de los
// specifiers de import en todos los .js/.mjs de tests/).

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = join(__filename, '..');
const ROOT = join(SCRIPT_DIR, '..', '..');
const TESTS_DIR = join(ROOT, 'tests');

const RENAMES = {
    case: 'cases',
    'aux-definitions': 'aux_definitions',
    mail: 'mails',
    groups: 'grupos',
    'aux-cases': 'aux_casos',
    report_executions: 'report-executions',
    secrets: 'secrets-vault',
    background_execution: 'background-executions',
    banner: 'banners',
    'action-model-update': 'action-update-model',
    'allowed-connections': 'allowed-conections',
    'aux-usuarios': 'aux_usuarios',
    flows: 'flow',
    roles: 'role',
    transitions: 'transition',
    'aux-clients': 'aux_clientes',
    'classifications-level-distinction': 'ClassificationsLevelDistinction',
};

function walk(dir, acc = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full, acc);
        } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
            acc.push(full);
        }
    }
    return acc;
}

// Matches the specifier string inside: from '...'  require('...')  import('...')  jest.mock('...')
// The whitespace between the keyword and the quote is captured too, so it survives the replacement.
const IMPORT_SPEC_RE = /(from|require\(|import\(|jest\.mock\()(\s*)(['"])([^'"]+)\3/g;

function rewriteSpecifier(spec) {
    if (!spec.startsWith('.')) return null; // only relative imports are in play here
    const segs = spec.split('/');
    let changed = false;
    const newSegs = segs.map((seg) => {
        if (Object.prototype.hasOwnProperty.call(RENAMES, seg)) {
            changed = true;
            return RENAMES[seg];
        }
        return seg;
    });
    if (!changed) return null;
    return newSegs.join('/');
}

const files = walk(TESTS_DIR);
let filesChanged = 0;
let specsChanged = 0;
const changeLog = [];

for (const file of files) {
    const original = readFileSync(file, 'utf8');
    let fileChanged = false;

    const updated = original.replace(IMPORT_SPEC_RE, (whole, keyword, ws, quote, spec) => {
        const rewritten = rewriteSpecifier(spec);
        if (rewritten === null) return whole;
        fileChanged = true;
        specsChanged++;
        changeLog.push({ file: relative(ROOT, file), from: spec, to: rewritten });
        return `${keyword}${ws}${quote}${rewritten}${quote}`;
    });

    if (fileChanged) {
        writeFileSync(file, updated);
        filesChanged++;
    }
}

console.log(`Archivos modificados: ${filesChanged}`);
console.log(`Specifiers reescritos: ${specsChanged}`);

if (process.env.REWRITE_IMPORTS_LOG) {
    writeFileSync(process.env.REWRITE_IMPORTS_LOG, JSON.stringify(changeLog, null, 2));
    console.log(`Log detallado escrito en ${process.env.REWRITE_IMPORTS_LOG}`);
}
