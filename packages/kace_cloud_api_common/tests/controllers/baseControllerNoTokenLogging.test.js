import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

describe('BaseController no loguea el token/headers ni usa console', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const src = readFileSync(join(__dirname, '../../src/controllers/BaseController.js'), 'utf8');

    it('no contiene el dump de token/headers', () => {
        expect(src).not.toMatch(/TOKEN-+/);
    });

    it('no usa console.* (viola no-console)', () => {
        expect(src).not.toMatch(/\bconsole\.\w+\(/);
    });
});
