import { FieldCatalog, createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

describe('createCasesFieldCatalog()', () => {
    const catalog = createCasesFieldCatalog();

    it('resolves a column field to a column descriptor', () => {
        const d = catalog.resolve('cases.responsable_id');
        expect(d).toEqual({ kind: 'column', table: 'cases', column: 'responsable_id' });
    });

    it('resolves cases.estadoActual alias to estados.id', () => {
        const d = catalog.resolve('cases.estadoActual');
        expect(d).toEqual({ kind: 'column', table: 'estados', column: 'id' });
    });

    it('resolves clasificaciones.description alias to cases.clasificacion_id', () => {
        const d = catalog.resolve('clasificaciones.description');
        expect(d).toEqual({ kind: 'column', table: 'cases', column: 'clasificacion_id' });
    });

    it('resolves aux_cases.foo.bar to jsonPath', () => {
        const d = catalog.resolve('aux_cases.foo.bar');
        expect(d).toEqual({
            kind: 'jsonPath',
            table: 'aux_cases',
            jsonColumn: 'data',
            path: ['foo', 'bar'],
        });
    });

    it('returns null for unknown field', () => {
        expect(catalog.resolve('unknown.foo')).toBeNull();
    });

    it('returns case-domain joins when clients/clasificaciones referenced', () => {
        const joins = catalog.describeJoins(new Set(['clients', 'clasificaciones']), 'cases');
        expect(joins).toEqual([
            { table: 'clients', on: ['cases.cliente_id', 'clients.id'] },
            { table: 'clasificaciones', on: ['cases.clasificacion_id', 'clasificaciones.id'] },
        ]);
    });

    it('emits the transiciones+estados pair when estados referenced', () => {
        const joins = catalog.describeJoins(new Set(['estados']), 'cases');
        expect(joins).toEqual([
            { table: 'transiciones', on: ['cases.transicion_id', 'transiciones.id'] },
            { table: 'estados', on: ['transiciones.siguiente_estado_id', 'estados.id'] },
        ]);
    });

    it('produces correct SQL expression for jsonPath descriptors', () => {
        const d = catalog.resolve('aux_cases.foo.bar');
        expect(catalog.columnExpression(d)).toBe("aux_cases.data #>> '{foo,bar}'");
    });

    it('produces correct SQL expression for column descriptors', () => {
        const d = catalog.resolve('cases.responsable_id');
        expect(catalog.columnExpression(d)).toBe('cases.responsable_id');
    });
});

describe('FieldCatalog constructor validation', () => {
    it('throws when columnTables is missing', () => {
        expect(() => new FieldCatalog({ jsonPrefixes: {}, joinPlanner: () => [] })).toThrow(/columnTables/);
    });
    it('throws when jsonPrefixes is missing', () => {
        expect(() => new FieldCatalog({ columnTables: {}, joinPlanner: () => [] })).toThrow(/jsonPrefixes/);
    });
    it('throws when joinPlanner is not a function', () => {
        expect(() => new FieldCatalog({ columnTables: {}, jsonPrefixes: {} })).toThrow(/joinPlanner/);
    });
});
