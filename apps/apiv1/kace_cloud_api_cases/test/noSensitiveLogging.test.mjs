import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

describe('controller no loguea datos sensibles ni serializa schemas eager', () => {
    const src = readFileSync(new URL('../src/controller.mjs', import.meta.url), 'utf8');

    it('no contiene el dump de token/headers', () => {
        expect(src).not.toMatch(/TOKEN-+/);
    });

    it('no llama .describe() dentro de logDebug', () => {
        expect(src).not.toMatch(/logDebug\([^)]*\.describe\(\)/);
    });
});
