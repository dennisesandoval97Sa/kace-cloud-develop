import { normalizePostmanUrl, extractEndpointFromRequest, groupByService } from '../runner/import-postman.mjs';

describe('normalizePostmanUrl', () => {
    it('strips {{baseUrl}} prefix', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/users/:id')).toBe('/users/{id}');
    });

    it('strips {{baseUrlmx}} prefix', () => {
        expect(normalizePostmanUrl('{{baseUrlmx}}/cases')).toBe('/cases');
    });

    it('strips {{G_DOMAIN}} prefix', () => {
        expect(normalizePostmanUrl('{{G_DOMAIN}}/cases/view/search')).toBe('/cases/view/search');
    });

    it('converts :id to {id} (single-placeholder paths only)', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/users/:id')).toBe('/users/{id}');
        expect(normalizePostmanUrl('{{baseUrl}}/cases/:id/comments')).toBe('/cases/{id}/comments');
    });

    it('preserves query strings', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/cases?limit=10')).toBe('/cases?limit=10');
    });

    it('returns null for fully-literal URLs (skipped)', () => {
        expect(normalizePostmanUrl('http://127.0.0.1:60051')).toBeNull();
    });

    it('returns null when path contains placeholders other than {id}', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/auxiliaries/:entity')).toBeNull();
        expect(normalizePostmanUrl('{{baseUrl}}/auxiliaries/{entidad}/search')).toBeNull();
        expect(normalizePostmanUrl('{{baseUrl}}/cases-count-by-responsable/:responableId')).toBeNull();
        expect(normalizePostmanUrl('{{baseUrl}}/boards/relations/:entity')).toBeNull();
    });

    it('returns null when path mixes {id} with other placeholders', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/users/:id/groups/:groupId')).toBeNull();
    });

    it('keeps URLs with no placeholder', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/users')).toBe('/users');
    });

    it('keeps URLs whose only placeholder is {id}', () => {
        expect(normalizePostmanUrl('{{baseUrl}}/users/:id')).toBe('/users/{id}');
        expect(normalizePostmanUrl('{{baseUrl}}/cases/:id/comments')).toBe('/cases/{id}/comments');
    });
});

describe('extractEndpointFromRequest', () => {
    it('extracts GET /users with no body', () => {
        const request = {
            name: 'Get users collection',
            request: {
                method: 'GET',
                url: { raw: '{{baseUrl}}/users' },
                body: null,
            },
        };
        const result = extractEndpointFromRequest(request);

        expect(result).toEqual({
            id: 'view-list',
            method: 'GET',
            path: '/users',
            requiresId: false,
        });
    });

    it('extracts GET /users/{id} with requiresId=true and id=view-by-id', () => {
        const request = {
            name: 'Fetch an user instance by ID',
            request: {
                method: 'GET',
                url: { raw: '{{baseUrlmx}}/users/:id' },
                body: null,
            },
        };
        const result = extractEndpointFromRequest(request);

        expect(result).toMatchObject({
            id: 'view-by-id',
            method: 'GET',
            path: '/users/{id}',
            requiresId: true,
        });
    });

    it('extracts POST /users/search with body parsed as JSON', () => {
        const request = {
            name: 'Get users with advanced filters',
            request: {
                method: 'POST',
                url: { raw: '{{baseUrlmx}}/users/search' },
                body: { mode: 'raw', raw: '{"limit":10,"offset":0}' },
            },
        };
        const result = extractEndpointFromRequest(request);

        expect(result.id).toBe('search');
        expect(result.method).toBe('POST');
        expect(result.path).toBe('/users/search');
        expect(result.body).toEqual({ limit: 10, offset: 0 });
    });

    it('returns null for non-GET-or-POST/search requests (e.g. PUT)', () => {
        const request = {
            name: 'Update user',
            request: { method: 'PUT', url: { raw: '{{baseUrl}}/users/:id' } },
        };
        expect(extractEndpointFromRequest(request)).toBeNull();
    });

    it('returns null for POST that is not /search or /view/search (creation)', () => {
        const request = {
            name: 'Create user',
            request: {
                method: 'POST',
                url: { raw: '{{baseUrl}}/users' },
                body: { mode: 'raw', raw: '{"name":"x"}' },
            },
        };
        expect(extractEndpointFromRequest(request)).toBeNull();
    });

    it('returns null when URL cannot be normalized (e.g. localhost literal)', () => {
        const request = {
            name: 'Local test',
            request: { method: 'POST', url: { raw: 'http://127.0.0.1:60051' } },
        };
        expect(extractEndpointFromRequest(request)).toBeNull();
    });
});

describe('extractEndpointFromRequest disambiguation', () => {
    it('appends path tail to view-by-id when path has segments after {id}', () => {
        const request = {
            request: { method: 'GET', url: { raw: '{{baseUrl}}/cases/:id/delete' } },
        };
        expect(extractEndpointFromRequest(request).id).toBe('view-by-id-delete');
    });

    it('appends path tail to view-list when path has segments after the service', () => {
        const request = {
            request: { method: 'GET', url: { raw: '{{baseUrl}}/cases/auxiliary' } },
        };
        expect(extractEndpointFromRequest(request).id).toBe('view-list-auxiliary');
    });

    it('handles multi-segment view-by-id tails', () => {
        const request = {
            request: { method: 'GET', url: { raw: '{{baseUrl}}/users/:id/groups/active' } },
        };
        expect(extractEndpointFromRequest(request).id).toBe('view-by-id-groups-active');
    });

    it('keeps view-list base id when no extra segments', () => {
        const request = {
            request: { method: 'GET', url: { raw: '{{baseUrl}}/users' } },
        };
        expect(extractEndpointFromRequest(request).id).toBe('view-list');
    });

    it('keeps view-by-id base id when no segments after {id}', () => {
        const request = {
            request: { method: 'GET', url: { raw: '{{baseUrl}}/users/:id' } },
        };
        expect(extractEndpointFromRequest(request).id).toBe('view-by-id');
    });

    it('keeps search id regardless of path shape', () => {
        const request = {
            request: {
                method: 'POST',
                url: { raw: '{{baseUrl}}/cases/view/search' },
                body: { mode: 'raw', raw: '{}' },
            },
        };
        expect(extractEndpointFromRequest(request).id).toBe('search');
    });
});

describe('groupByService', () => {
    const collection = {
        item: [
            {
                name: 'Users',
                item: [
                    { name: 'list', request: { method: 'GET', url: { raw: '{{baseUrl}}/users' } } },
                    { name: 'get', request: { method: 'GET', url: { raw: '{{baseUrl}}/users/:id' } } },
                ],
            },
            {
                name: 'Cases',
                item: [{ name: 'list', request: { method: 'GET', url: { raw: '{{baseUrl}}/cases' } } }],
            },
            {
                name: 'Comments',
                item: [{ name: 'list', request: { method: 'GET', url: { raw: '{{baseUrl}}/cases/:id/comments' } } }],
            },
            {
                name: 'IgnoredFolder',
                item: [{ name: 'x', request: { method: 'GET', url: { raw: '{{baseUrl}}/x' } } }],
            },
        ],
    };

    it('matches single folder to single service via mapping', () => {
        const mapping = { users: 'Users' };
        const result = groupByService(collection, mapping);

        expect(result.users).toHaveLength(2);
        expect(result.users[0].path).toBe('/users');
    });

    it('matches multiple folders to one service when mapping is array', () => {
        const mapping = { cases: ['Cases', 'Comments'] };
        const result = groupByService(collection, mapping);

        expect(result.cases).toHaveLength(2);
        expect(result.cases.map((e) => e.path)).toEqual(expect.arrayContaining(['/cases', '/cases/{id}/comments']));
    });

    it('skips folders not listed in mapping', () => {
        const mapping = { users: 'Users' };
        const result = groupByService(collection, mapping);

        expect(result.IgnoredFolder).toBeUndefined();
    });
});
