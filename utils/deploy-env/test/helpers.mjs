import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createContext } from '../context.mjs';

/**
 * Doble de `run(cmd, args, opts)`. Cada ruta tiene `match` (string contenido en la
 * línea de comando o RegExp) y `result` (objeto o función que recibe la llamada).
 * La primera ruta que coincide gana; sin coincidencia devuelve code 0 y salida vacía.
 */
export function createFakeRun(routes = []) {
    const calls = [];
    const run = async (cmd, args = [], opts = {}) => {
        const call = { cmd, args, opts, line: [cmd, ...args].join(' ') };
        calls.push(call);
        const route = routes.find((candidate) =>
            typeof candidate.match === 'string' ? call.line.includes(candidate.match) : candidate.match.test(call.line)
        );
        if (!route) {
            return { code: 0, stdout: '', stderr: '' };
        }
        const result = typeof route.result === 'function' ? await route.result(call) : route.result;
        return { code: 0, stdout: '', stderr: '', ...result };
    };
    return { run, calls };
}

export const DEFAULT_FLAGS = Object.freeze({
    envFile: '.env.test',
    yes: false,
    expectAccount: '',
    from: '',
    only: '',
    dryRun: false,
    overwriteTenant: false,
    concurrency: 0,
    help: false,
});

/**
 * Contexto de test sobre un directorio temporal que hace de raíz del repo.
 * `files` escribe ficheros extra relativos a esa raíz (p. ej. `.env.example`).
 */
export function makeCtx({
    envText = 'APPS_SERVICE_NAME=svc\n',
    flags = {},
    routes = [],
    answers = [],
    files = {},
} = {}) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'deploy-env-test-'));
    const file = path.join(dir, '.env.test');
    writeFileSync(file, envText);
    for (const [relative, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
        writeFileSync(path.join(dir, relative), content);
    }
    const fake = createFakeRun(routes);
    const output = [];
    const asked = [];
    const sleeps = [];
    const ctx = createContext({
        rootDir: dir,
        envFile: file,
        flags: { ...DEFAULT_FLAGS, ...flags },
        run: fake.run,
        ask: async (question) => {
            asked.push(question);
            return answers.length ? answers.shift() : false;
        },
        write: (text) => output.push(text),
        now: () => new Date(2026, 8, 29, 10, 0, 0),
        sleep: async (ms) => {
            sleeps.push(ms);
        },
        processEnv: { PATH: process.env.PATH },
    });
    ctx.envActivation = {
        activations: 0,
        activate() {
            this.activations += 1;
        },
        restore() {},
    };
    return { ctx, calls: fake.calls, output, asked, sleeps, dir, file };
}
