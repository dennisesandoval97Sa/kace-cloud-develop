// packages/kace_cloud_core/tests/support/noSqliteInTests.test.js
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@jest/globals';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS_DIR = join(ROOT_DIR, 'tests');
const SELF = 'support/noSqliteInTests.test.js';

/**
 * Deuda heredada de la migracion de la fase 2. Este numero solo puede bajar.
 * Si un cambio lo sube, es que se reintrodujo una referencia a sqlite en una
 * suite que ya deberia estar solo en postgres.
 */
const REFERENCIAS_TOLERADAS = 60;

test('las referencias a sqlite en tests/ no crecen', () => {
    const files = globSync('**/*.js', { cwd: TESTS_DIR }).filter((file) => file !== SELF);
    const hits = [];

    for (const file of files) {
        const absolute = join(TESTS_DIR, file);

        readFileSync(absolute, 'utf8')
            .split('\n')
            .forEach((line, index) => {
                if (line.toLowerCase().includes('sqlite')) {
                    hits.push(`${relative(ROOT_DIR, absolute)}:${index + 1}`);
                }
            });
    }

    expect(hits.length).toBeLessThanOrEqual(REFERENCIAS_TOLERADAS);
});
