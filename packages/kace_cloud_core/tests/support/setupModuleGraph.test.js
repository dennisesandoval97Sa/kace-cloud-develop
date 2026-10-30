import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@jest/globals';
import jestConfig from '../../jest.config.js';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_DIR = join(ROOT_DIR, 'src');

// `import x from 'y'` / `import 'y'` / `export … from 'y'`. Deliberadamente NO
// captura `import('y')` dinamico: un import dinamico dentro de un hook
// (beforeAll) corre DESPUES de evaluar el archivo de test, asi que no envenena
// el registro. Lo que rompe es el enlazado estatico, que es lo que se mide aqui.
const STATIC_IMPORT = /(?:^|[\s;{}])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

/**
 * Resuelve un specifier relativo igual que jest-resolve: tal cual, con `.js`
 * anadido, o como directorio con `index.js`.
 *
 * @param {string} specifier
 * @param {string} importer ruta absoluta del archivo que importa
 * @returns {string|null}
 */
const resolveRelative = (specifier, importer) => {
    const base = resolve(dirname(importer), specifier);

    for (const candidate of [base, `${base}.js`, join(base, 'index.js')]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
            return candidate;
        }
    }

    return null;
};

/**
 * Cierre transitivo de los imports estaticos a partir de unos entrypoints.
 *
 * @param {string[]} entrypoints rutas absolutas
 * @returns {Map<string, string|null>} modulo -> quien lo importo (null si es entrypoint)
 */
const staticImportClosure = (entrypoints) => {
    const seen = new Map(entrypoints.map((entry) => [entry, null]));
    const pending = [...entrypoints];

    while (pending.length > 0) {
        const file = pending.pop();
        const source = readFileSync(file, 'utf8');

        for (const [, specifier] of source.matchAll(STATIC_IMPORT)) {
            if (!specifier.startsWith('.')) {
                continue;
            }

            const resolved = resolveRelative(specifier, file);

            if (resolved && !seen.has(resolved)) {
                seen.set(resolved, file);
                pending.push(resolved);
            }
        }
    }

    return seen;
};

/**
 * Cadena de imports desde el entrypoint hasta `file`, para que el fallo diga
 * exactamente por donde se colo `src/`.
 *
 * @param {Map<string, string|null>} graph
 * @param {string} file
 * @returns {string}
 */
const importChain = (graph, file) => {
    const chain = [];

    for (let current = file; current; current = graph.get(current)) {
        chain.unshift(relative(ROOT_DIR, current));
    }

    return chain.join('\n    -> ');
};

const setupEntrypoints = jestConfig.setupFilesAfterEnv.map((entry) =>
    resolve(ROOT_DIR, entry.replace('<rootDir>/', ''))
);

test('setupFilesAfterEnv exists and points at real files', () => {
    expect(setupEntrypoints.length).toBeGreaterThan(0);
    setupEntrypoints.forEach((entry) => expect(existsSync(entry)).toBe(true));
});

test('the setupFilesAfterEnv static import graph pulls in no src/ module', () => {
    // GUARDIAN DE REGRESION.
    //
    // setupFilesAfterEnv se evalua ANTES que el archivo de test. Todo modulo que
    // quede enlazado ahi ya esta unido a sus dependencias REALES cuando el test
    // ejecuta `jest.unstable_mockModule`, asi que el mock queda registrado pero
    // inerte y el codigo bajo prueba usa la dependencia de verdad.
    //
    // Cuando `tests/support/testRolePermissions.js` estaba en esta cadena,
    // importaba el barril `src/shared/index.js` y arrastraba 788 de los 1728
    // modulos de `src/`. Cuatro suites abrian conexiones reales a S3, Gmail y
    // SQS con los mocks puestos. Si este test falla, NO lo relajes: mueve el
    // trabajo que necesita `src/` a globalSetup (ver templateDatabase.js).
    const graph = staticImportClosure(setupEntrypoints);
    const fromSrc = [...graph.keys()].filter((file) => file.startsWith(`${SRC_DIR}/`));

    const detail = fromSrc.map((file) => importChain(graph, file)).join('\n\n');

    expect(fromSrc.length === 0 ? '' : detail).toBe('');
});
