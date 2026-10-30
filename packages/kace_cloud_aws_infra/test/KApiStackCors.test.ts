import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('KApiStack CORS contract', () => {
    it('advertises only the supported GET, POST, and OPTIONS methods', () => {
        const source = readFileSync(path.resolve(__dirname, '../src/KApiStack.ts'), 'utf8');

        expect(source).toContain("allowMethods: ['GET', 'POST', 'OPTIONS']");
        expect(source.match(/'Access-Control-Allow-Methods': "'GET,POST,OPTIONS'"/g)).toHaveLength(2);
        expect(source).not.toContain('GET,POST,PUT,OPTIONS');
    });
});
