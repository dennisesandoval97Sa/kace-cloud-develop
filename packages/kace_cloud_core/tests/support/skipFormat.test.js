// packages/kace_cloud_core/tests/support/skipFormat.test.js
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import { expect, test } from '@jest/globals';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TESTS_DIR = join(ROOT_DIR, 'tests');

// `.skip` se busca en cualquier posicion de la linea, no solo al principio y no
// solo seguido de parentesis: el idioma condicional
// `const x = COND ? describe : describe.skip;` tambien salta tests y tambien
// necesita explicacion. Una version anterior anclada a `^\s*...\.skip\s*\(` se
// dejaba fuera ese caso, y con el, uno de los siete skips del repositorio.
const SKIP = /\b(?:it|test|describe)\.skip\b|^\s*(?:xit|xdescribe)\s*\(/;
const CATEGORIES = ['bug-src', 'obsoleto', 'decision-pendiente'];
const SELF = 'support/skipFormat.test.js';
const MARKER = new RegExp(`KACE-SKIP\\((${CATEGORIES.join('|')})\\)`);

/**
 * Un `skip` esta documentado si alguna de las cinco lineas anteriores lleva el
 * marcador. Cinco porque el motivo suele ocupar dos o tres lineas de comentario.
 *
 * @param {string[]} lines
 * @param {number} index
 * @returns {boolean}
 */
const isDocumented = (lines, index) => lines.slice(Math.max(0, index - 5), index).some((line) => MARKER.test(line));

test('todo skip lleva un comentario KACE-SKIP(categoria) con el motivo', () => {
    const files = globSync('**/*.test.js', { cwd: TESTS_DIR })
        .filter((file) => file !== SELF)
        .map((file) => join(TESTS_DIR, file));
    const offenders = [];

    for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');

        lines.forEach((line, index) => {
            if (SKIP.test(line) && isDocumented(lines, index) === false) {
                offenders.push(`${relative(ROOT_DIR, file)}:${index + 1}`);
            }
        });
    }

    expect(offenders).toEqual([]);
});
