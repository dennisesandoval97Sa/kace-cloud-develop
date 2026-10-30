import {
    applyCaseInsensitiveOrders,
    getEffectiveOrderDataType,
} from '../../src/boards/domain/applyCaseInsensitiveOrders.js';

describe('getEffectiveOrderDataType', () => {
    it('returns NUMBER for count, sum, avg, date_difference', () => {
        expect(getEffectiveOrderDataType({ function: 'count', data_type: 'STRING' })).toBe('NUMBER');
        expect(getEffectiveOrderDataType({ function: 'sum', data_type: 'DATE' })).toBe('NUMBER');
        expect(getEffectiveOrderDataType({ function: 'avg', data_type: 'STRING' })).toBe('NUMBER');
        expect(getEffectiveOrderDataType({ function: 'date_difference', data_type: 'DATE' })).toBe('NUMBER');
    });

    it('preserves column data_type for min and max', () => {
        expect(getEffectiveOrderDataType({ function: 'min', data_type: 'DATE' })).toBe('DATE');
        expect(getEffectiveOrderDataType({ function: 'max', data_type: 'NUMBER' })).toBe('NUMBER');
    });

    it('returns column data_type when no function', () => {
        expect(getEffectiveOrderDataType({ data_type: 'STRING' })).toBe('STRING');
    });

    it('returns null when col is null or undefined', () => {
        expect(getEffectiveOrderDataType(null)).toBeNull();
        expect(getEffectiveOrderDataType(undefined)).toBeNull();
    });

    it('preserves column data_type for functions outside count/sum/avg/date_difference/min/max', () => {
        expect(getEffectiveOrderDataType({ function: 'concat', data_type: 'STRING' })).toBe('STRING');
    });

    it('returns null (fallback ?? null) when there is no function and data_type is missing', () => {
        expect(getEffectiveOrderDataType({})).toBeNull();
    });

    it('returns null (fallback ?? null) for min/max when data_type is missing', () => {
        expect(getEffectiveOrderDataType({ function: 'min' })).toBeNull();
    });

    it('returns null (fallback ?? null) for an unknown function when data_type is missing', () => {
        expect(getEffectiveOrderDataType({ function: 'concat' })).toBeNull();
    });
});

describe('applyCaseInsensitiveOrders', () => {
    it('sets order.data_type to NUMBER for date_difference columns with DATE metadata', () => {
        const orders = { field: 'diff_alias', direction: 'asc' };
        const selectColumns = [
            {
                entity: 'aux_x',
                field: 'created_at',
                alias: 'diff_alias',
                data_type: 'DATE',
                function: 'date_difference',
            },
        ];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBe('NUMBER');
        expect(orders.insensitive).toBeUndefined();
    });

    it('uses original DATE type when ordering by raw field of a date_difference column', () => {
        const orders = { field: 'created_at', entity: 'cases', direction: 'desc' };
        const selectColumns = [
            {
                entity: 'cases',
                field: 'created_at',
                alias: 'creado',
                data_type: 'DATE',
                function_type: 'comparison',
                function: 'date_difference',
            },
        ];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBe('DATE');
        expect(orders.insensitive).toBeUndefined();
    });

    it('sets insensitive for STRING columns without aggregate mismatch', () => {
        const orders = { field: 'nombre', direction: 'asc' };
        const selectColumns = [
            {
                entity: 'aux_x',
                field: 'persona.nombre',
                alias: 'nombre',
                data_type: 'STRING',
                function: null,
            },
        ];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBe('STRING');
        expect(orders.insensitive).toBe(true);
    });

    it('deja el order sin tocar cuando no matchea ninguna columna del select', () => {
        const orders = { field: 'no_existe', direction: 'asc' };
        const selectColumns = [{ entity: 'cases', field: 'id', alias: 'id', data_type: 'NUMBER' }];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBeUndefined();
        expect(orders.insensitive).toBeUndefined();
    });

    it('acepta un array de orders y aplica la logica a cada uno', () => {
        const orders = [{ field: 'id', entity: 'cases' }, { field: 'nombre' }];
        const selectColumns = [
            { entity: 'cases', field: 'id', alias: 'id', data_type: 'NUMBER' },
            { entity: 'cases', field: 'persona.nombre', alias: 'nombre', data_type: 'STRING' },
        ];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders[0].data_type).toBe('NUMBER');
        expect(orders[0].insensitive).toBeUndefined();
        expect(orders[1].data_type).toBe('STRING');
        expect(orders[1].insensitive).toBe(true);
    });

    it('no lanza y no matchea nada cuando el order no trae field ni entity (orderFieldKey vacio)', () => {
        const orders = { direction: 'asc' };
        const selectColumns = [{ entity: 'cases', field: 'id', alias: 'id', data_type: 'NUMBER' }];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBeUndefined();
        expect(orders.insensitive).toBeUndefined();
    });

    it('matchea una columna sin entity (usa col.field directo) y sin alias (usa col.field como aliasOrField)', () => {
        const orders = { field: 'legacy_field' };
        const selectColumns = [{ field: 'legacy_field', data_type: 'NUMBER' }];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBe('NUMBER');
    });

    it('no setea data_type cuando el effectiveType queda en null (orden por el field crudo de una columna date_difference sin data_type)', () => {
        // order.field='created_at' matchea col.field, NO col.alias ('diff_alias'), asi que
        // isOrderByAlias da false y se toma la rama que relee matchingCol.data_type (ausente).
        const orders = { field: 'created_at', entity: 'aux_x' };
        const selectColumns = [
            {
                entity: 'aux_x',
                field: 'created_at',
                alias: 'diff_alias',
                function: 'date_difference',
            },
        ];
        applyCaseInsensitiveOrders(orders, selectColumns);
        expect(orders.data_type).toBeUndefined();
        expect(orders.insensitive).toBeUndefined();
    });
});
