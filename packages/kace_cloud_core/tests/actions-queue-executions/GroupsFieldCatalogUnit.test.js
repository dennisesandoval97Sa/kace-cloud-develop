import { createGroupsFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

describe('createGroupsFieldCatalog()', () => {
    const catalog = createGroupsFieldCatalog();

    it('resolves grupos.nombre to a column descriptor', () => {
        expect(catalog.resolve('grupos.nombre')).toEqual({
            kind: 'column',
            table: 'grupos',
            column: 'nombre',
        });
    });

    it('resolves aux_groups.foo to jsonPath over grupos.data', () => {
        expect(catalog.resolve('aux_groups.foo')).toEqual({
            kind: 'jsonPath',
            table: 'grupos',
            jsonColumn: 'data',
            path: ['foo'],
        });
    });

    it('returns null for excluded JSON-shaped columns (permisos, layouts, comportamientos, ips_allowed)', () => {
        expect(catalog.resolve('grupos.permisos')).toBeNull();
        expect(catalog.resolve('grupos.layouts')).toBeNull();
        expect(catalog.resolve('grupos.comportamientos')).toBeNull();
        expect(catalog.resolve('grupos.ips_allowed')).toBeNull();
    });

    it('returns null for foreign-domain prefixes (cases.*, usuarios.*, clients.*)', () => {
        expect(catalog.resolve('cases.id')).toBeNull();
        expect(catalog.resolve('usuarios.email')).toBeNull();
        expect(catalog.resolve('clients.email')).toBeNull();
    });

    it('describeJoins returns []', () => {
        expect(catalog.describeJoins(new Set(['aux_groups']), 'grupos')).toEqual([]);
    });

    it('columnExpression for jsonPath uses grupos.data', () => {
        const d = catalog.resolve('aux_groups.foo');
        expect(catalog.columnExpression(d)).toBe("grupos.data #>> '{foo}'");
    });
});
