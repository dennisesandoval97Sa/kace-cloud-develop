import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTestKnex, testSchemaName, resetSchema, dropSchema } from '../support/test-database.js';

const execFileAsync = promisify(execFile);
const sourceSchema = testSchemaName('sync_cli_src');
const targetSchema = testSchemaName('sync_cli_dst');
let knex;
let tempDir;

const cliEnv = () => ({
    ...process.env,
    DB_SYNC_SOURCE_HOST: process.env.DB_TEST_HOST,
    DB_SYNC_SOURCE_PORT: process.env.DB_TEST_PORT,
    DB_SYNC_SOURCE_USER: process.env.DB_TEST_USER,
    DB_SYNC_SOURCE_PASSWORD: process.env.DB_TEST_PASSWORD,
    DB_SYNC_TARGET_HOST: process.env.DB_TEST_HOST,
    DB_SYNC_TARGET_PORT: process.env.DB_TEST_PORT,
    DB_SYNC_TARGET_USER: process.env.DB_TEST_USER,
    DB_SYNC_TARGET_PASSWORD: process.env.DB_TEST_PASSWORD,
});

const writeConfig = async (name, tables) => {
    const path = join(tempDir, name);
    await writeFile(
        path,
        JSON.stringify({
            source: { database: process.env.DB_TEST_DATABASE, schema: sourceSchema },
            target: { database: process.env.DB_TEST_DATABASE, schema: targetSchema },
            tables,
        })
    );

    return path;
};

const runCli = (configPath) =>
    // A bounded timeout turns a regression that leaks the knex pool (process hangs instead of
    // exiting) into a fast, clearly-attributable failure instead of silently eating the full
    // Jest testTimeout.
    execFileAsync('node', ['bin/sync.js', '--config', configPath], {
        env: cliEnv(),
        cwd: process.cwd(),
        timeout: 10000,
    });

beforeAll(async () => {
    knex = createTestKnex();
    tempDir = await mkdtemp(join(tmpdir(), 'db-sync-cli-'));
    await resetSchema(knex, sourceSchema);
    await resetSchema(knex, targetSchema);
    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text)`, [sourceSchema]);
    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text)`, [targetSchema]);
    await knex.withSchema(sourceSchema).insert({ id: 1, nombre: 'ana' }).into('clientes');
});

afterAll(async () => {
    await dropSchema(knex, sourceSchema);
    await dropSchema(knex, targetSchema);
    await knex.destroy();
    await rm(tempDir, { recursive: true, force: true });
});

describe('CLI', () => {
    it('should sync and exit 0 when every table succeeds', async () => {
        const configPath = await writeConfig('ok.json', [{ name: 'clientes' }]);

        const { stdout } = await runCli(configPath);

        expect(stdout).toContain('✓ clientes');
        expect(stdout).toContain('Resumen: 1/1 tablas OK');
        const rows = await knex.withSchema(targetSchema).select('*').from('clientes');
        expect(rows).toEqual([{ id: 1, nombre: 'ana' }]);
    });

    it('should exit non-zero when a table fails', async () => {
        const configPath = await writeConfig('fail.json', [{ name: 'inexistente' }]);

        const rejection = await runCli(configPath).catch((error) => error);

        expect(rejection).toMatchObject({ code: 1 });
        // Per-table failures are reported (not a fatal crash): the CLI must still print the
        // per-table ✗ line and summary on stdout, and must NOT print "Fallo fatal:" on stderr.
        expect(rejection.stdout).toContain('✗ inexistente');
        expect(rejection.stdout).toContain('Resumen: 0/1 tablas OK');
        expect(rejection.stderr).not.toContain('Fallo fatal:');
    });

    it('should exit non-zero when the config file is invalid', async () => {
        const path = join(tempDir, 'invalid.json');
        await writeFile(path, JSON.stringify({ source: { database: 'x', schema: 'y' } }));

        const rejection = await runCli(path).catch((error) => error);

        expect(rejection).toMatchObject({ code: 1 });
        expect(rejection.stderr).toContain('Fallo fatal: Invalid sync config:');
        expect(rejection.stdout).toBe('');
    });

    it('should exit non-zero when the config file does not exist', async () => {
        const rejection = await runCli(join(tempDir, 'no-existe.json')).catch((error) => error);

        expect(rejection).toMatchObject({ code: 1 });
        expect(rejection.stderr).toContain('Fallo fatal: ENOENT');
        expect(rejection.stdout).toBe('');
    });
});
