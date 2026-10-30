import { findDisallowedCapabilities, resolveCapabilities } from '../../src/search-authorization/capabilityValidator.js';

describe('findDisallowedCapabilities', () => {
    const allDisabled = {
        pagination: false,
        order: false,
        relationship: false,
        select: false,
        distinct: false,
        group_by: false,
        having: false,
    };

    it.each([
        ['select', { select: ['a'] }],
        ['distinct', { distinct: true }],
        ['group_by', { group_by: ['a'] }],
        ['having', { having: [{ field: 'a' }] }],
        ['order', { order: ['a'] }],
        ['relationship', { relationship: [{ table: 'x' }] }],
    ])('flags %s when disabled and present in the query', (capability, query) => {
        expect(findDisallowedCapabilities(query, allDisabled)).toContain(capability);
    });

    it('flags pagination when disabled and limit/offset present', () => {
        expect(findDisallowedCapabilities({ limit: 10 }, allDisabled)).toContain('pagination');
        expect(findDisallowedCapabilities({ offset: 5 }, allDisabled)).toContain('pagination');
    });

    it('does not flag capabilities whose value is empty array or false', () => {
        expect(findDisallowedCapabilities({ select: [], distinct: false }, allDisabled)).toEqual([]);
    });

    it('does not flag enabled capabilities', () => {
        const enabled = { ...allDisabled, distinct: true, group_by: true };
        expect(findDisallowedCapabilities({ distinct: true, group_by: ['a'] }, enabled)).toEqual([]);
    });

    it('resolveCapabilities merges over defaults', () => {
        const resolved = resolveCapabilities({ select: true });
        expect(resolved.select).toBe(true);
        expect(resolved.pagination).toBe(true);
        expect(resolved.having).toBe(false);
    });
});
