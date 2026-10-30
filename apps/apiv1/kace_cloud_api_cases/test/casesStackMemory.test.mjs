import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

describe('cases-stack memorySize', () => {
    it('la Lambda de casos usa 1024 MB', () => {
        const stack = readFileSync(new URL('../lib/cases-stack.ts', import.meta.url), 'utf8');
        expect(stack).toMatch(/memorySize:\s*1024/);
        expect(stack).not.toMatch(/memorySize:\s*512/);
    });
});
