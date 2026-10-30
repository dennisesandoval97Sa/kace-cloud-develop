import { Criteria, TenantContext } from '../../../src/shared/index.js';
import { parseJsonPathDateBetweenValue } from '../../../src/shared/criteria/JsonPathDateBetween.js';
import { knexConfig } from '../../knexfile.js';

const TABLE = 'json_path_date_between_rows';
const bogotaTenant = { id: { value: 'tenant-id' }, timezone: { value: 'America/Bogota' } };

const bogotaDay = (day) => ({
    path: 'initialDate',
    from: `${day}T00:00:00.000-05:00`,
    to: `${day}T23:59:59.999-05:00`,
});

const findIds = async (value, type = 'and') => {
    const filters = [{ field: 'period', operator: 'jsonPathDateBetween', value: JSON.stringify(value), type }];
    const criteria = new Criteria(filters, [], null, null, null, TABLE);
    const rows = await criteria.convertToKnex(knexConfig(TABLE).select('id').orderBy('id'));
    return rows.map(({ id }) => id);
};

const findIdsAsTenant = (tenant, value, type) => TenantContext.run(tenant, () => findIds(value, type));

describe('jsonPathDateBetween against PostgreSQL', () => {
    const rows = [
        [1, '2025-12-27'],
        [2, '2025-12-27T23:30:00'],
        [3, '2025-12-27T05:00:00.000Z'],
        [4, '2025-12-27T04:59:59.999Z'],
        [5, '2025-02-30'],
        [6, '2025-13-01'],
        [7, '2025-12-27T25:00:00'],
        [8, '0000-12-27'],
        [9, '2025-12-27T10:00:00+99:00'],
        [10, 'not a date'],
        [11, null],
        [12, '2025-12-27T23:00:00-05:00'],
    ];

    // perFileDatabase.js resets the database before each test.
    beforeEach(async () => {
        await knexConfig.schema.createTable(TABLE, (table) => {
            table.integer('id');
            table.jsonb('period');
        });
        await knexConfig(TABLE).insert(
            rows.map(([id, initialDate]) => ({
                id,
                period: JSON.stringify(initialDate === null ? { endDate: '2025-12-27' } : { initialDate }),
            }))
        );
    });

    test('reads stored values without offset in the tenant timezone', async () => {
        expect(await findIdsAsTenant(bogotaTenant, bogotaDay('2025-12-27'))).toEqual([1, 2, 3, 12]);
        expect(await findIdsAsTenant(bogotaTenant, bogotaDay('2025-12-26'))).toEqual([4]);
    });

    test('falls back to UTC for stored values without offset when there is no tenant', async () => {
        const utcDay = { path: 'initialDate', from: '2025-12-27T00:00:00.000Z', to: '2025-12-27T23:59:59.999Z' };

        expect(await findIds(utcDay)).toEqual([1, 2, 3, 4]);
    });

    test('skips malformed stored dates instead of failing the whole query', async () => {
        const wholeRange = { path: 'initialDate', from: '0001-01-01T00:00:00Z', to: '9999-12-31T23:59:59Z' };

        expect(await findIdsAsTenant(bogotaTenant, wholeRange)).toEqual([1, 2, 3, 4, 12]);
    });

    test('applies the same condition when the filter is an OR', async () => {
        expect(await findIdsAsTenant(bogotaTenant, bogotaDay('2025-12-27'), 'OR')).toEqual([1, 2, 3, 12]);
    });
});

describe('parseJsonPathDateBetweenValue', () => {
    const from = '2025-12-30T00:00:00.000-05:00';
    const to = '2025-12-30T23:59:59.999-05:00';

    test('accepts a JSON string or an already parsed object', () => {
        expect(parseJsonPathDateBetweenValue(JSON.stringify({ path: 'endDate', from, to }))).toEqual({
            path: 'endDate',
            from,
            to,
        });
        expect(parseJsonPathDateBetweenValue({ path: 'endDate', from, to: '2025-12-31T04:59:59Z' })).toEqual({
            path: 'endDate',
            from,
            to: '2025-12-31T04:59:59Z',
        });
        expect(parseJsonPathDateBetweenValue({ path: 'endDate', from: '2024-02-29T00:00:00+14:00', to })).toEqual({
            path: 'endDate',
            from: '2024-02-29T00:00:00+14:00',
            to,
        });
    });

    test.each([
        ['a non JSON value', 'not-json'],
        ['a missing path', JSON.stringify({ from, to })],
        ['a nested path', JSON.stringify({ path: 'range.start', from, to })],
        ['a path that is not a plain key', JSON.stringify({ path: "initialDate'--", from, to })],
        ['a day that does not exist', JSON.stringify({ path: 'initialDate', from: '2025-02-30T00:00:00Z', to })],
        ['a month that does not exist', JSON.stringify({ path: 'initialDate', from: '2025-13-01T00:00:00Z', to })],
        ['an out of range hour', JSON.stringify({ path: 'initialDate', from: '2025-12-30T24:00:00Z', to })],
        ['an out of range offset', JSON.stringify({ path: 'initialDate', from: '2025-12-30T00:00:00+99:00', to })],
        ['a date without time', JSON.stringify({ path: 'initialDate', from: '2025-12-30', to })],
        ['a date-time without offset', JSON.stringify({ path: 'initialDate', from: '2025-12-30T00:00:00', to })],
        ['a non ISO date', JSON.stringify({ path: 'initialDate', from, to: 'Dec 30' })],
        ['an empty end date', JSON.stringify({ path: 'initialDate', from, to: '' })],
    ])('rejects %s', (_, value) => {
        expect(() => parseJsonPathDateBetweenValue(value)).toThrow('Invalid JsonPathDateBetween value');
    });
});
