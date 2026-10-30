import { BoardUnifiedStatusPolicy } from '../../src/boards/domain/BoardUnifiedStatusPolicy.js';

describe('BoardUnifiedStatusPolicy', () => {
    it('columnTreatsAsUnifiedStatus infers from leaf status or is_active', () => {
        expect(
            BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus({ entity: 'x', field: 'a.status', alias: 's' })
        ).toBe(true);
        expect(
            BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus({ entity: 'x', field: 'flags.is_active', alias: 'ia' })
        ).toBe(true);
        expect(
            BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus({ entity: 'x', field: 'flags.activo', alias: 'a' })
        ).toBe(false);
    });

    it('columnTreatsAsUnifiedStatus respects is_status_column', () => {
        expect(
            BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus({
                entity: 'x',
                field: 'flags.activo',
                alias: 'a',
                is_status_column: true,
            })
        ).toBe(true);
        expect(
            BoardUnifiedStatusPolicy.columnTreatsAsUnifiedStatus({
                entity: 'x',
                field: 'flags.is_active',
                alias: 'ia',
                is_status_column: false,
            })
        ).toBe(false);
    });

    it('isRawActive covers boolean number and string', () => {
        expect(BoardUnifiedStatusPolicy.isRawActive(true)).toBe(true);
        expect(BoardUnifiedStatusPolicy.isRawActive(1)).toBe(true);
        expect(BoardUnifiedStatusPolicy.isRawActive('1')).toBe(true);
        expect(BoardUnifiedStatusPolicy.isRawActive('true')).toBe(true);
        expect(BoardUnifiedStatusPolicy.isRawActive(false)).toBe(false);
        expect(BoardUnifiedStatusPolicy.isRawActive(0)).toBe(false);
        expect(BoardUnifiedStatusPolicy.isRawActive(2)).toBe(false);
        expect(BoardUnifiedStatusPolicy.isRawActive('2')).toBe(false);
    });

    it('expandFilters replaces eq boolean on unified columns', () => {
        const select = [
            {
                entity: 'aux_x',
                field: 'flags.is_active',
                alias: 'is_active',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const out = BoardUnifiedStatusPolicy.expandFilters(
            [{ entity: 'aux_x', field: 'is_active', operator: 'eq', value: true, type: 'AND' }],
            select,
            't'
        );
        expect(out[0].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].sql).toContain('t.is_active');
        expect(out[0].sql).toMatch(/LOWER\s*\(\s*TRIM/i);
        expect(out[0].sql).not.toMatch(/::numeric\s*=\s*1/);
    });

    it('expandFilters generates JSONB extraction SQL for dot-notation field on direct table access', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'flags.is_active',
                alias: 'ia',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const out = BoardUnifiedStatusPolicy.expandFilters(
            [{ entity: 'aux_proveedores', field: 'flags.is_active', operator: 'eq', value: true, type: 'AND' }],
            select,
            'aux_proveedores'
        );
        expect(out[0].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].sql).toContain("aux_proveedores.flags->>'is_active'");
        expect(out[0].sql).toMatch(/LOWER\s*\(\s*TRIM/i);
    });

    it('expandFilters uses projected alias for subquery result reference', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'flags.is_active',
                alias: 'ia',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const out = BoardUnifiedStatusPolicy.expandFilters(
            [{ entity: 'aux_proveedores', field: 'flags.is_active', operator: 'eq', value: true, type: 'AND' }],
            select,
            't'
        );
        expect(out[0].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].sql).toContain('t.ia');
        expect(out[0].sql).not.toContain('t."flags.is_active"');
    });

    it('isRawActive returns false for a string matching none of the known patterns', () => {
        expect(BoardUnifiedStatusPolicy.isRawActive('maybe')).toBe(false);
    });

    it('expandFilters usa extraccion JSONB de ruta multi-nivel (#>>) cuando el campo dot-notation tiene mas de un segmento', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'flags.nested.is_active',
                alias: 'ia',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const out = BoardUnifiedStatusPolicy.expandFilters(
            [{ entity: 'aux_proveedores', field: 'flags.nested.is_active', operator: 'eq', value: true, type: 'AND' }],
            select,
            'aux_proveedores'
        );
        expect(out[0].isBoardUnifiedSqlWhere).toBe(true);
        // Ruta de un solo segmento usa ->>; de dos o mas usa el operador #>> con un path array.
        expect(out[0].sql).toContain("aux_proveedores.flags #>> '{nested,is_active}'");
        expect(out[0].sql).not.toContain('->>');
    });

    it('expandFilters genera SQL de inactivo (NOT (...)) cuando el valor booleano es false', () => {
        const select = [
            {
                entity: 'aux_x',
                field: 'flags.is_active',
                alias: 'is_active',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const out = BoardUnifiedStatusPolicy.expandFilters(
            [{ entity: 'aux_x', field: 'is_active', operator: 'eq', value: false, type: 'AND' }],
            select,
            't'
        );
        expect(out[0].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].sql).toMatch(/^NOT \(/);
        // El interior de NOT(...) es exactamente la misma expresion que el caso "activo".
        expect(out[0].sql).toContain('t.is_active');
    });

    it('expandFilters expande recursivamente los filtros anidados dentro de un groupType', () => {
        const select = [
            {
                entity: 'aux_x',
                field: 'flags.is_active',
                alias: 'is_active',
                is_filterable: true,
                data_type: 'BOOLEAN',
            },
        ];
        const grouped = {
            groupType: 'OR',
            filters: [
                { entity: 'aux_x', field: 'is_active', operator: 'eq', value: true, type: 'AND' },
                { entity: 'aux_x', field: 'is_active', operator: 'eq', value: false, type: 'OR' },
            ],
        };
        const out = BoardUnifiedStatusPolicy.expandFilters([grouped], select, 't');
        expect(out[0].groupType).toBe('OR');
        expect(out[0].filters).toHaveLength(2);
        expect(out[0].filters[0].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].filters[0].sql).not.toMatch(/^NOT \(/);
        expect(out[0].filters[1].isBoardUnifiedSqlWhere).toBe(true);
        expect(out[0].filters[1].sql).toMatch(/^NOT \(/);
    });

    it('expandFilters leaves non unified filters unchanged', () => {
        const select = [
            {
                entity: 'aux_x',
                field: 'nombre',
                alias: 'nombre',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        const f = { entity: 'aux_x', field: 'nombre', operator: 'eq', value: 'a', type: 'AND' };
        const out = BoardUnifiedStatusPolicy.expandFilters([f], select, 't');
        expect(out[0]).toEqual(f);
    });
});
