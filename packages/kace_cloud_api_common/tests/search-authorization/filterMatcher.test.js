import {
    findMissingBaseFilters,
    findDisallowedFilters,
    findMissingRequiredFilterGroups,
    normalizeFilter,
} from '../../src/search-authorization/filterMatcher.js';

describe('filterMatcher', () => {
    const baseFilter = [
        { field: 'status', operator: 'eq', value: 1, type: 'AND' },
        { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
    ];

    it('normalizes filters in a stable key order', () => {
        expect(normalizeFilter({ type: 'AND', value: 1, operator: 'eq', field: 'status' })).toEqual({
            field: 'status',
            operator: 'eq',
            type: 'AND',
            value: 1,
        });
    });

    it('detects missing mandatory base filters', () => {
        const submitted = [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }];

        expect(findMissingBaseFilters(baseFilter, submitted)).toEqual([
            { field: 'deleted_at', operator: 'null', type: 'AND', value: 'null' },
        ]);
    });

    it('does not count base filters nested under OR groups as mandatory constraints', () => {
        const tenantBaseFilter = [{ field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' }];
        const submitted = [
            {
                groupType: 'OR',
                filters: [
                    { field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' },
                    { field: 'status', operator: 'eq', value: 'open', type: 'OR' },
                ],
            },
        ];

        expect(findMissingBaseFilters(tenantBaseFilter, submitted)).toEqual([
            { field: 'tenant_id', operator: 'eq', type: 'AND', value: 123 },
        ]);
    });

    it('does not count top-level base filters when followed by OR filters', () => {
        const tenantBaseFilter = [{ field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' }];
        const submitted = [
            { field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' },
            { field: 'status', operator: 'eq', value: 'open', type: 'OR' },
        ];

        expect(findMissingBaseFilters(tenantBaseFilter, submitted)).toEqual([
            { field: 'tenant_id', operator: 'eq', type: 'AND', value: 123 },
        ]);
    });

    it('does not count base filters in AND groups that contain OR subfilters', () => {
        const tenantBaseFilter = [{ field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' }];
        const submitted = [
            {
                groupType: 'AND',
                filters: [
                    { field: 'tenant_id', operator: 'eq', value: 123, type: 'AND' },
                    { field: 'status', operator: 'eq', value: 'open', type: 'OR' },
                ],
            },
        ];

        expect(findMissingBaseFilters(tenantBaseFilter, submitted)).toEqual([
            { field: 'tenant_id', operator: 'eq', type: 'AND', value: 123 },
        ]);
    });

    it('allows extra filters only when field and operator are allowlisted', () => {
        const submitted = [
            ...baseFilter,
            { field: 'documento', operator: 'eq', value: '123', type: 'AND' },
            { field: 'id', operator: 'ilike', value: '%abc%', type: 'AND' },
        ];
        const allowed = [{ field: 'documento', operators: ['eq'] }];

        expect(findDisallowedFilters(baseFilter, submitted, allowed)).toEqual([
            { field: 'id', operator: 'ilike', type: 'AND', value: '%abc%' },
        ]);
    });

    it('checks nested group filters recursively', () => {
        const submitted = [
            ...baseFilter,
            {
                groupType: 'OR',
                filters: [
                    { field: 'documento', operator: 'eq', value: '123', type: 'AND' },
                    { field: 'email', operator: 'ilike', value: '%x%', type: 'OR' },
                ],
            },
        ];
        const allowed = [{ field: 'documento', operators: ['eq'] }];

        expect(findDisallowedFilters(baseFilter, submitted, allowed)).toEqual([
            { field: 'email', operator: 'ilike', type: 'OR', value: '%x%' },
        ]);
    });

    it('detects when none of the required search criteria are present', () => {
        const requiredFilterGroups = [
            {
                name: 'client_specific_search_criteria',
                filters: [
                    { field: 'documento', operators: ['eq', 'like', 'ilike'] },
                    { field: 'email', operators: ['ilike'] },
                ],
            },
        ];

        expect(findMissingRequiredFilterGroups(requiredFilterGroups, baseFilter)).toEqual(requiredFilterGroups);
    });

    it('accepts a required search criterion with a meaningful value', () => {
        const requiredFilterGroups = [
            {
                name: 'client_specific_search_criteria',
                filters: [{ field: 'documento', operators: ['eq', 'like', 'ilike'] }],
            },
        ];
        const submitted = [...baseFilter, { field: 'documento', operator: 'eq', value: '123456789', type: 'AND' }];

        expect(findMissingRequiredFilterGroups(requiredFilterGroups, submitted)).toEqual([]);
    });

    it('does not accept wildcard-only search criteria as meaningful values', () => {
        const requiredFilterGroups = [
            {
                name: 'client_specific_search_criteria',
                filters: [{ field: 'email', operators: ['ilike'] }],
            },
        ];
        const submitted = [...baseFilter, { field: 'email', operator: 'ilike', value: ' %%_ ', type: 'AND' }];

        expect(findMissingRequiredFilterGroups(requiredFilterGroups, submitted)).toEqual(requiredFilterGroups);
    });
});

describe('findMissingRequiredFilterGroups — OR evasion', () => {
    const group = {
        name: 'client_specific_search_criteria',
        filters: [{ field: 'documento', operators: ['eq', 'like', 'ilike'], requireValue: true }],
    };

    it('still reports the group as missing when the required criterion is only inside an OR group', () => {
        const submitted = [
            {
                groupType: 'OR',
                filters: [
                    { field: 'documento', operator: 'like', value: '123', type: 'OR' },
                    { field: 'status', operator: 'eq', value: 1, type: 'OR' },
                ],
            },
        ];
        expect(findMissingRequiredFilterGroups([group], submitted)).toHaveLength(1);
    });

    it('accepts the group when the required criterion is a top-level AND filter', () => {
        const submitted = [{ field: 'documento', operator: 'like', value: '123', type: 'AND' }];
        expect(findMissingRequiredFilterGroups([group], submitted)).toHaveLength(0);
    });
});

describe('findMissingBaseFilters — deeply nested OR', () => {
    const base = [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }];

    it('treats a 3-level-deep OR as invalidating the base filters', () => {
        const submitted = [
            {
                groupType: 'AND',
                filters: [
                    {
                        groupType: 'AND',
                        filters: [{ groupType: 'OR', filters: [{ field: 'x', operator: 'eq', value: 2 }] }],
                    },
                ],
            },
        ];
        expect(findMissingBaseFilters(base, submitted)).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'status' })])
        );
    });
});
