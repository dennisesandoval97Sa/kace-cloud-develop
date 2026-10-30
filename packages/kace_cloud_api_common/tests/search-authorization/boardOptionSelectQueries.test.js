import { SearchAuthorizationService } from '../../src/search-authorization/SearchAuthorizationService.js';
import { getSearchPolicy, searchPolicies } from '../../src/search-authorization/SearchPolicyRegistry.js';
import { SearchSchema } from '../../src/validation/schemas/SearchSchema.js';

const userWithoutAdvancedPermission = {
    hasPermission: () => false,
};

const deletedAt = { field: 'deleted_at', operator: 'null', type: 'AND', value: 'null' };
const isPrimary = { field: 'is_primary', operator: 'eq', type: 'AND', value: 'true' };

const endpoints = [
    {
        endpointKey: 'actions.search',
        searchField: 'description',
        order: { field: 'description', direction: 'asc' },
        extraPageFilters: [],
    },
    {
        endpointKey: 'one-script.search',
        searchField: 'name',
        order: { field: 'name', direction: 'asc' },
        extraPageFilters: [],
    },
    {
        endpointKey: 'ws-rest-flows.search',
        searchField: 'description',
        order: { field: 'description', direction: 'asc' },
        extraPageFilters: [isPrimary],
    },
];

const pageQuery = ({ extraPageFilters, order }) => ({
    filter: [deletedAt, ...extraPageFilters],
    limit: 50,
    offset: 0,
    order,
    relationship: null,
});

const ilikeQuery = ({ extraPageFilters, searchField, order }) => ({
    filter: [deletedAt, ...extraPageFilters, { field: searchField, operator: 'ilike', type: 'AND', value: 'Beta' }],
    limit: 50,
    offset: 0,
    order,
    relationship: null,
});

const ensureQuery = (ids) => ({
    filter: [deletedAt, { field: 'id', operator: 'in', type: 'AND', value: ids.join(',') }],
    limit: ids.length,
    offset: 0,
    order: { field: 'description', direction: 'asc' },
    relationship: null,
});

const shapesFor = (endpoint) => [
    ['page', pageQuery(endpoint)],
    ['ilike', ilikeQuery(endpoint)],
    ['ensure 1 id', ensureQuery(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'])],
    ['ensure N ids', ensureQuery(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'])],
];

describe('board option select queries (useSearchableSelectOptions)', () => {
    const service = new SearchAuthorizationService({ policies: searchPolicies });

    it.each(
        endpoints.flatMap((endpoint) =>
            shapesFor(endpoint).map(([shape, query]) => [endpoint.endpointKey, shape, query])
        )
    )(
        'SearchSchema and SearchAuthorizationService accept %s %s without *SearchAdvanced',
        (endpointKey, _shape, query) => {
            expect(SearchSchema.validate(query, { abortEarly: false }).error).toBeUndefined();
            expect(service.authorize({ endpointKey, user: userWithoutAdvancedPermission, query })).toBe(query);
        }
    );

    it('registers id eq/in on the three board option search endpoints', () => {
        for (const endpointKey of ['actions.search', 'one-script.search', 'ws-rest-flows.search']) {
            expect(getSearchPolicy(endpointKey).allowedFilters).toEqual(
                expect.arrayContaining([{ field: 'id', operators: ['eq', 'in'] }])
            );
        }
    });
});
