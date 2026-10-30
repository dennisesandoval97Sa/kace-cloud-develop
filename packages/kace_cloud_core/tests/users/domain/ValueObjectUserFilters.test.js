import { ValueObjectUserFilters } from '../../../src/users/domain/ValueObjectUserFilters.js';

describe('ValueObjectUserFilters', () => {
    it('accepts a structure with an "admin" key inside application', () => {
        const vo = new ValueObjectUserFilters('filters', { application: { admin: { column: 'estado' } } });

        expect(vo.value).toEqual({ application: { admin: { column: 'estado' } } });
    });

    it('accepts a structure with an "agent" key inside application', () => {
        const vo = new ValueObjectUserFilters('filters', { application: { agent: { column: 'prioridad' } } });

        expect(vo.value).toEqual({ application: { agent: { column: 'prioridad' } } });
    });

    it('throws when application has neither "admin" nor "agent"', () => {
        expect(() => new ValueObjectUserFilters('filters', { application: { other: true } })).toThrow(
            'filters: The structure must include admin or agent objects'
        );
    });

    it('throws when application itself is missing', () => {
        expect(() => new ValueObjectUserFilters('filters', { notApplication: true })).toThrow(
            'filters: The structure must include admin or agent objects'
        );
    });

    it('returns without a value when nullable is true and no value is provided', () => {
        const vo = new ValueObjectUserFilters('filters', null, true);

        expect(vo.value).toBeNull();
    });
});
