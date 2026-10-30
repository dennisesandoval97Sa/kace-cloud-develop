#!/usr/bin/env node
/**
 * Tarea 16: elimina de los archivos de test los hooks (beforeAll/beforeEach/
 * afterEach/afterAll) que preparaban una base de datos sqlite/postgres propia
 * por migracion (migrate.latest / migrate.rollback / resetSchemaAndMigrate /
 * migrateLatest / migrateRollback) y las llamadas sueltas a `.destroy()` sobre
 * conexiones. Con la infraestructura actual cada archivo de test recibe su
 * propia base clonada en beforeAll y la elimina en afterAll (ver
 * tests/support/perFileDatabase.js), asi que esos hooks son puro residuo.
 *
 * Si un hook mezcla preparacion de BD con otra logica (siembra de datos,
 * mocks, configuracion), se conserva el resto y solo se quitan las sentencias
 * de BD.
 *
 * ## Guarda: archivos que importan `knex` directamente
 *
 * Un `.destroy()` (o `migrate.latest` / `migrate.rollback`) solo es residuo
 * seguro de quitar cuando la conexion que cierra es la compartida por archivo
 * (`knexConfig`, importada de `../knexfile.js` y gestionada por
 * `tests/support/perFileDatabase.js`). Un puñado de archivos construyen su
 * PROPIA instancia de knex (`Knex(...)` / `knexLib(...)`, casi siempre sqlite
 * `:memory:` o un pool postgres aparte con su propio schema) para aislar un
 * escenario -- pool con `max>1`, sqlite en memoria, un segundo pool contra el
 * mismo servidor. Esa instancia NO la cierra `perFileDatabase.js`, asi que su
 * `.destroy()`/`migrate.*` es necesario de verdad, no un remanente.
 *
 * Distinguir esto con precision requiere seguir el flujo de datos (que
 * identificador envuelve a cual instancia) y el riesgo de una regla mal
 * afinada es alto: se confirmo en la revision manual del dry-run que el
 * patron ingenuo (cualquier `.destroy()` de 0 argumentos dentro de un hook)
 * borra limpiezas reales en varios archivos (p. ej.
 * `tests/auth-cognito/AuthCognito.integration.test.js`, cuyo describe
 * `LogoutUser` usa un `Knex({ client: 'sqlite3', ... })` local, o
 * `tests/cases/createCaseTransactionIntegration.test.js`, cuyo `knexConfig`
 * local -- mismo nombre, instancia distinta -- apunta a un schema por
 * worker). Por eso, cualquier archivo que importe el export por defecto de
 * `'knex'` se excluye ENTERO de la reescritura automatica y se reporta para
 * tratamiento manual, aunque tambien tenga hooks puramente atados a la
 * `knexConfig` compartida.
 *
 * Uso:
 *   node scripts/migrate-tests/remove-db-hooks.mjs --dry-run
 *   node scripts/migrate-tests/remove-db-hooks.mjs --apply
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = path.resolve(__dirname, '../..');
const TESTS_ROOT = path.join(CORE_ROOT, 'tests');

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run';
const VERBOSE = process.argv.includes('--verbose');

/**
 * Localiza el paquete `name` dentro del almacen de pnpm sin declararlo como
 * dependencia del workspace: es una herramienta de desarrollo de un solo uso
 * para este codemod, no una dependencia de @kace/core.
 *
 * @param {string} name
 * @returns {string} ruta absoluta al entry point ESM del paquete
 */
const resolvePnpmPackageEsm = (name) => {
    let dir = CORE_ROOT;

    for (let i = 0; i < 6; i++) {
        const store = path.join(dir, 'node_modules', '.pnpm');

        if (fs.existsSync(store)) {
            const candidates = fs.readdirSync(store).filter((entry) => entry === name || entry.startsWith(`${name}@`));

            if (candidates.length > 0) {
                const pkgDir = path.join(store, candidates[0], 'node_modules', name);
                const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

                return path.join(pkgDir, pkgJson.module ?? pkgJson.main);
            }
        }

        dir = path.dirname(dir);
    }

    throw new Error(`No se pudo localizar "${name}" en ningun node_modules/.pnpm ascendiendo desde ${CORE_ROOT}`);
};

const acorn = await import(pathToFileURL(resolvePnpmPackageEsm('acorn')).href);
const walk = await import(pathToFileURL(resolvePnpmPackageEsm('acorn-walk')).href);

const HOOK_NAMES = new Set(['beforeAll', 'beforeEach', 'afterEach', 'afterAll']);
const MIGRATE_METHOD_NAMES = new Set(['resetSchemaAndMigrate', 'migrateLatest', 'migrateRollback']);

/**
 * Recorre recursivamente todos los `*.test.js` bajo `dir`.
 *
 * @param {string} dir
 * @returns {string[]}
 */
const listTestFiles = (dir) => {
    const out = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            out.push(...listTestFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
            out.push(full);
        }
    }

    return out;
};

/**
 * Desenvuelve `await expr` -> expr.
 *
 * @param {import('acorn').Node} expr
 * @returns {import('acorn').Node}
 */
const unwrapAwait = (expr) => (expr.type === 'AwaitExpression' ? expr.argument : expr);

/**
 * True si `expr` es una llamada a una de las formas objetivo:
 * `<algo>.migrate.latest(...)`, `<algo>.migrate.rollback(...)`, `<algo>.migrate.down(...)`,
 * `<algo>.resetSchemaAndMigrate(...)`, `<algo>.migrateLatest(...)`,
 * `<algo>.migrateRollback(...)`, `<algo>.destroy()` (sin argumentos).
 *
 * @param {import('acorn').Node} expr
 * @returns {boolean}
 */
const isTargetCall = (expr) => {
    if (expr.type !== 'CallExpression') return false;

    const callee = expr.callee;

    if (callee.type !== 'MemberExpression' || callee.computed) return false;

    const propertyName = callee.property.name;

    if (propertyName === 'destroy') {
        return expr.arguments.length === 0;
    }

    if (MIGRATE_METHOD_NAMES.has(propertyName)) {
        return true;
    }

    if (propertyName === 'latest' || propertyName === 'rollback' || propertyName === 'down') {
        const object = callee.object;

        return (
            object.type === 'MemberExpression' &&
            !object.computed &&
            object.property.type === 'Identifier' &&
            object.property.name === 'migrate'
        );
    }

    return false;
};

/**
 * True si `stmt` es, en su totalidad, preparacion/limpieza de base de datos:
 * una sentencia objetivo directa, o un try/catch/finally cuyas partes
 * presentes son, cada una, integramente sentencias objetivo (cubre el patron
 * de retry `try { migrate.latest() } catch { migrate.latest() }` y el de
 * `try { destroy() } catch { swallow }`).
 *
 * @param {import('acorn').Node} stmt
 * @returns {boolean}
 */
const isDbOnlyStatement = (stmt) => {
    if (stmt.type === 'ExpressionStatement') {
        return isTargetCall(unwrapAwait(stmt.expression));
    }

    if (stmt.type === 'TryStatement') {
        const blockOk = stmt.block.body.every(isDbOnlyStatement);
        const handlerOk = !stmt.handler || stmt.handler.body.body.every(isDbOnlyStatement);
        const finalizerOk = !stmt.finalizer || stmt.finalizer.body.every(isDbOnlyStatement);

        return blockOk && handlerOk && finalizerOk;
    }

    return false;
};

/**
 * True si `stmt` contiene, en algun nivel superficial (el propio statement o
 * las ramas de un try/catch/finally), alguna llamada objetivo -- se usa para
 * detectar sentencias que MEZCLAN db con otra cosa dentro de un try, un caso
 * que este codemod no intenta recortar automaticamente.
 *
 * @param {import('acorn').Node} stmt
 * @returns {boolean}
 */
const containsDbCallShallow = (stmt) => {
    if (stmt.type === 'ExpressionStatement') {
        return isTargetCall(unwrapAwait(stmt.expression));
    }

    if (stmt.type === 'TryStatement') {
        const inBlock = stmt.block.body.some(containsDbCallShallow);
        const inHandler = stmt.handler ? stmt.handler.body.body.some(containsDbCallShallow) : false;
        const inFinalizer = stmt.finalizer ? stmt.finalizer.body.some(containsDbCallShallow) : false;

        return inBlock || inHandler || inFinalizer;
    }

    return false;
};

/**
 * Calcula el rango [start, end) a borrar para `node`, extendido a lineas
 * completas cuando el resto de la linea (antes y despues del nodo) es solo
 * espacio en blanco -- asi no quedan lineas en blanco huerfanas ni se
 * corrompe una linea con codigo ajeno.
 *
 * @param {string} source
 * @param {import('acorn').Node} node
 * @returns {{start: number, end: number}}
 */
const lineDeletionRange = (source, node) => {
    let start = node.start;
    let end = node.end;

    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    const prefix = source.slice(lineStart, start);

    if (/^\s*$/.test(prefix)) {
        start = lineStart;
    }

    let lineEnd = source.indexOf('\n', end);
    lineEnd = lineEnd === -1 ? source.length : lineEnd + 1;
    const suffix = source.slice(end, lineEnd);

    if (/^\s*$/.test(suffix)) {
        end = lineEnd;
    }

    return { start, end };
};

/**
 * Procesa un archivo de test: encuentra los hooks objetivo y decide, por
 * cada uno, si se borra entero o se recorta.
 *
 * @param {string} filePath
 * @param {string} source
 * @returns {{
 *   removalRanges: {start: number, end: number}[],
 *   hooksRemoved: number,
 *   hooksTrimmed: number,
 *   statementsRemoved: number,
 *   warnings: string[],
 *   parseError: string|null,
 * }}
 */
const analyzeFile = (filePath, source) => {
    const result = {
        removalRanges: [],
        hooksRemoved: 0,
        hooksTrimmed: 0,
        statementsRemoved: 0,
        warnings: [],
        parseError: null,
        excludedReason: null,
        log: [],
    };

    let ast;

    try {
        ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    } catch (error) {
        result.parseError = error.message;

        return result;
    }

    const importsKnexDirectly = ast.body.some(
        (node) => node.type === 'ImportDeclaration' && node.source.value === 'knex'
    );
    const importsGetKnexInstance = ast.body.some(
        (node) =>
            node.type === 'ImportDeclaration' &&
            node.specifiers.some((s) => s.type === 'ImportSpecifier' && s.imported.name === 'getKnexInstance')
    );

    if (importsKnexDirectly || importsGetKnexInstance) {
        result.excludedReason = importsGetKnexInstance
            ? 'importa getKnexInstance -- singleton de modulo separado de knexConfig (ver Limpieza adicional); ' +
              'excluido de la reescritura automatica'
            : "importa 'knex' directamente -- puede construir instancias locales cuyo .destroy()/migrate.* " +
              'no es residuo (ver comentario de cabecera); excluido de la reescritura automatica';

        return result;
    }

    walk.simple(ast, {
        ExpressionStatement(stmtNode) {
            const expr = stmtNode.expression;

            if (expr.type !== 'CallExpression') return;
            if (expr.callee.type !== 'Identifier' || !HOOK_NAMES.has(expr.callee.name)) return;

            const cb = expr.arguments.find(
                (a) => a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression'
            );

            if (!cb || cb.body.type !== 'BlockStatement') {
                if (expr.arguments.some((a) => containsDbCallLoose(source, a))) {
                    result.warnings.push(
                        `${expr.callee.name} en linea ${stmtNode.loc.start.line}: callback sin cuerpo de bloque, no se pudo analizar`
                    );
                }

                return;
            }

            const topStmts = cb.body.body;
            const dbIndices = [];
            const suspiciousIndices = [];

            topStmts.forEach((stmt, i) => {
                if (isDbOnlyStatement(stmt)) {
                    dbIndices.push(i);
                } else if (containsDbCallShallow(stmt)) {
                    suspiciousIndices.push(i);
                }
            });

            if (suspiciousIndices.length > 0) {
                result.warnings.push(
                    `${expr.callee.name} en linea ${stmtNode.loc.start.line}: sentencia try/catch mezcla ` +
                        `llamadas de BD con otra logica; no se recorto automaticamente (revisar a mano)`
                );
            }

            if (dbIndices.length === 0) return;

            if (dbIndices.length === topStmts.length) {
                result.removalRanges.push(lineDeletionRange(source, stmtNode));
                result.hooksRemoved += 1;
                result.log.push({
                    line: stmtNode.loc.start.line,
                    hook: expr.callee.name,
                    action: 'removed-whole',
                    statements: topStmts.map((s) => source.slice(s.start, s.end).split('\n')[0]),
                });
            } else {
                for (const i of dbIndices) {
                    result.removalRanges.push(lineDeletionRange(source, topStmts[i]));
                    result.statementsRemoved += 1;
                }
                result.hooksTrimmed += 1;
                result.log.push({
                    line: stmtNode.loc.start.line,
                    hook: expr.callee.name,
                    action: 'trimmed',
                    removed: dbIndices.map((i) => source.slice(topStmts[i].start, topStmts[i].end).split('\n')[0]),
                    kept: topStmts
                        .filter((_, i) => !dbIndices.includes(i))
                        .map((s) => source.slice(s.start, s.end).split('\n')[0]),
                });
            }
        },
    });

    return result;
};

/**
 * Heuristica barata (sin AST) para no perder de vista callbacks sin cuerpo
 * de bloque que sin embargo mencionan los patrones objetivo -- solo se usa
 * para decidir si vale la pena advertir.
 *
 * @param {string} source
 * @param {import('acorn').Node} node
 * @returns {boolean}
 */
const containsDbCallLoose = (source, node) => {
    const text = source.slice(node.start, node.end);

    return /migrate\.(latest|rollback|down)|resetSchemaAndMigrate|migrateLatest|migrateRollback|\.destroy\(\s*\)/.test(
        text
    );
};

const CANDIDATE_PATTERN =
    /migrate\.(latest|rollback|down)|resetSchemaAndMigrate|migrateLatest|migrateRollback|\.destroy\(\s*\)/;

const main = async () => {
    const files = listTestFiles(TESTS_ROOT).sort();
    const candidateFiles = [];

    let totalHooksRemoved = 0;
    let totalHooksTrimmed = 0;
    let totalStatementsRemoved = 0;
    let filesChanged = 0;

    const untouchedCandidates = [];
    const parseErrors = [];
    const warningFiles = [];
    const excludedFiles = [];

    for (const filePath of files) {
        const source = await readFile(filePath, 'utf8');

        if (!CANDIDATE_PATTERN.test(source)) continue;

        const relPath = path.relative(CORE_ROOT, filePath);
        candidateFiles.push(relPath);

        const analysis = analyzeFile(filePath, source);

        if (analysis.parseError) {
            parseErrors.push({ file: relPath, error: analysis.parseError });
            continue;
        }

        if (analysis.excludedReason) {
            excludedFiles.push({ file: relPath, reason: analysis.excludedReason });
            continue;
        }

        if (analysis.warnings.length > 0) {
            warningFiles.push({ file: relPath, warnings: analysis.warnings });
        }

        if (analysis.removalRanges.length === 0) {
            untouchedCandidates.push(relPath);
            continue;
        }

        totalHooksRemoved += analysis.hooksRemoved;
        totalHooksTrimmed += analysis.hooksTrimmed;
        totalStatementsRemoved += analysis.statementsRemoved;
        filesChanged += 1;

        if (VERBOSE) {
            for (const entry of analysis.log) {
                if (entry.action === 'trimmed') {
                    console.log(`TRIM  ${relPath}:${entry.line} ${entry.hook}`);
                    for (const r of entry.removed) console.log(`      - ${r}`);
                    console.log(`      kept:`);
                    for (const k of entry.kept) console.log(`      + ${k}`);
                } else {
                    console.log(`WHOLE ${relPath}:${entry.line} ${entry.hook} (${entry.statements.length} stmt)`);
                }
            }
        }

        if (MODE === 'apply') {
            let next = source;
            const ranges = [...analysis.removalRanges].sort((a, b) => b.start - a.start);

            for (const { start, end } of ranges) {
                next = next.slice(0, start) + next.slice(end);
            }

            await writeFile(filePath, next, 'utf8');
        }
    }

    console.log(`Modo: ${MODE}`);
    console.log(`Archivos candidatos (contienen algun patron objetivo): ${candidateFiles.length}`);
    console.log(`Archivos modificados: ${filesChanged}`);
    console.log(`Hooks eliminados enteros: ${totalHooksRemoved}`);
    console.log(`Hooks recortados (mixtos): ${totalHooksTrimmed}`);
    console.log(`Sentencias sueltas eliminadas dentro de hooks mixtos: ${totalStatementsRemoved}`);

    if (parseErrors.length > 0) {
        console.log(`\nArchivos con error de parseo (${parseErrors.length}):`);
        for (const { file, error } of parseErrors) {
            console.log(`  - ${file}: ${error}`);
        }
    }

    if (excludedFiles.length > 0) {
        console.log(`\nArchivos EXCLUIDOS de la reescritura automatica (${excludedFiles.length}) -- tratar a mano:`);
        for (const { file, reason } of excludedFiles) {
            console.log(`  - ${file}: ${reason}`);
        }
    }

    if (untouchedCandidates.length > 0) {
        console.log(`\nArchivos candidatos SIN cambios aplicados (${untouchedCandidates.length}) -- revisar a mano:`);
        for (const file of untouchedCandidates) {
            console.log(`  - ${file}`);
        }
    }

    if (warningFiles.length > 0) {
        console.log(`\nAdvertencias (hooks no recortados automaticamente, revisar a mano):`);
        for (const { file, warnings } of warningFiles) {
            console.log(`  ${file}`);
            for (const w of warnings) {
                console.log(`    - ${w}`);
            }
        }
    }
};

await main();
