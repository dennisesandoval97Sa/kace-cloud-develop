import { selectTemplate, renderScenario } from '../runner/generate-scenarios.mjs';

describe('selectTemplate', () => {
    it('picks "view-by-id" when requiresId=true and method=GET', () => {
        const endpoint = { method: 'GET', path: '/users/{id}', requiresId: true };
        expect(selectTemplate(endpoint)).toBe('view-by-id');
    });

    it('picks "view-list" when method=GET and !requiresId', () => {
        const endpoint = { method: 'GET', path: '/users', requiresId: false };
        expect(selectTemplate(endpoint)).toBe('view-list');
    });

    it('picks "search" when method=POST and path ends in /search or /view/search', () => {
        expect(selectTemplate({ method: 'POST', path: '/users/search', requiresId: false })).toBe('search');
        expect(selectTemplate({ method: 'POST', path: '/cases/view/search', requiresId: false })).toBe('search');
    });

    it('returns null for unsupported shapes (e.g. POST without /search)', () => {
        expect(selectTemplate({ method: 'POST', path: '/users', requiresId: false })).toBeNull();
    });
});

describe('renderScenario', () => {
    it('renders view-list template with correct path', () => {
        const code = renderScenario({
            template: 'view-list',
            endpoint: { method: 'GET', path: '/users', requiresId: false },
        });

        expect(code).toContain("import { get } from '../_shared/http.js';");
        expect(code).toContain("get('/users')");
    });

    it('renders view-by-id template with loadIds at init context and pickRandom inside default', () => {
        const code = renderScenario({
            template: 'view-by-id',
            endpoint: { method: 'GET', path: '/users/{id}', requiresId: true },
            table: 'usuarios',
        });

        expect(code).toContain("import { loadIds, pickRandom } from '../_shared/data-pool.js';");
        expect(code).toContain("const IDS = loadIds('usuarios');");
        expect(code).toContain('const id = pickRandom(IDS);');
        expect(code).toContain("'/users/{id}'.replace('{id}', id)");
    });

    it('renders search template with body inlined as JSON literal', () => {
        const code = renderScenario({
            template: 'search',
            endpoint: {
                method: 'POST',
                path: '/users/search',
                requiresId: false,
                body: { limit: 10, offset: 0 },
            },
        });

        expect(code).toContain('const SEARCH_BODY =');
        expect(code).toMatch(/"limit":\s*10/);
        expect(code).toContain("post('/users/search', SEARCH_BODY)");
    });

    it('throws when view-by-id template missing table', () => {
        expect(() =>
            renderScenario({
                template: 'view-by-id',
                endpoint: { method: 'GET', path: '/users/{id}', requiresId: true },
            })
        ).toThrow(/table.*required/i);
    });
});
