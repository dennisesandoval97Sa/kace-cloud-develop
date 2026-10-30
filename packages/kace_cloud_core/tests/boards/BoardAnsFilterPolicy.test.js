import { BoardAnsFilterPolicy } from '../../src/boards/domain/BoardAnsFilterPolicy.js';

describe('BoardAnsFilterPolicy.stripFilters', () => {
    const ansSelect = [
        { entity: 'cases', field: 'ans_posicion', alias: 'ans_pos', is_ans: true },
        { entity: 'cases', field: 'status', alias: 'status' },
        { entity: 'cases', field: 'fecha_creacion', alias: 'fecha_creacion' },
    ];

    it('returns input untouched when no ans columns in select', () => {
        const filters = [{ entity: 'cases', field: 'status', operator: 'eq', value: 'open' }];
        const selectWithoutAns = [{ entity: 'cases', field: 'status', alias: 'status' }];
        expect(BoardAnsFilterPolicy.stripFilters(filters, selectWithoutAns)).toBe(filters);
    });

    it('returns input untouched when filters is null or not array', () => {
        expect(BoardAnsFilterPolicy.stripFilters(null, ansSelect)).toBeNull();
        expect(BoardAnsFilterPolicy.stripFilters(undefined, ansSelect)).toBeUndefined();
        expect(BoardAnsFilterPolicy.stripFilters('not-array', ansSelect)).toBe('not-array');
    });

    it('keeps the quick ans filter shape (eq with value 1, 2, or 3)', () => {
        const filters = [
            { entity: 'cases', field: 'ans_pos', operator: 'eq', value: 1 },
            { entity: 'cases', field: 'ans_posicion', operator: 'eq', value: 2 },
            { entity: 'cases', field: 'ans_pos', operator: 'eq', value: '3' },
        ];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual(filters);
    });

    it('drops an ans filter with a date range (the bug it was meant to prevent)', () => {
        const filters = [
            { entity: 'cases', field: 'ans_posicion', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
            { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
        ];
        const result = BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(result).toEqual([{ entity: 'cases', field: 'status', operator: 'eq', value: 'open' }]);
    });

    it('drops an ans filter with eq but a non-integer value', () => {
        const filters = [{ entity: 'cases', field: 'ans_pos', operator: 'eq', value: '2026-01-01' }];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual([]);
    });

    it('drops an ans filter with eq but an integer outside {1,2,3}', () => {
        const filters = [{ entity: 'cases', field: 'ans_pos', operator: 'eq', value: 4 }];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual([]);
    });

    it('drops an ans filter with eq and a boolean value (Number(true) === 1 must not slip through)', () => {
        const filters = [
            { entity: 'cases', field: 'ans_pos', operator: 'eq', value: true },
            { entity: 'cases', field: 'ans_pos', operator: 'eq', value: false },
        ];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual([]);
    });

    it('does not drop filters on non-ans columns with the same entity', () => {
        const filters = [
            { entity: 'cases', field: 'fecha_creacion', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
        ];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual(filters);
    });

    it('does not drop filters on the same field name but a different entity', () => {
        const filters = [
            { entity: 'other_table', field: 'ans_posicion', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
        ];
        expect(BoardAnsFilterPolicy.stripFilters(filters, ansSelect)).toEqual(filters);
    });

    it('drops invalid ans filters inside a group and keeps valid ones plus non-ans siblings', () => {
        const filters = [
            {
                groupType: 'AND',
                filters: [
                    {
                        entity: 'cases',
                        field: 'ans_posicion',
                        operator: 'between',
                        value: ['2026-01-01', '2026-12-31'],
                    },
                    { entity: 'cases', field: 'ans_pos', operator: 'eq', value: 1 },
                    { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
                ],
            },
        ];
        const result = BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(result).toEqual([
            {
                groupType: 'AND',
                filters: [
                    { entity: 'cases', field: 'ans_pos', operator: 'eq', value: 1 },
                    { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
                ],
            },
        ]);
    });

    it('drops a group entirely when all its children are invalid ans filters', () => {
        const filters = [
            {
                groupType: 'OR',
                filters: [
                    {
                        entity: 'cases',
                        field: 'ans_posicion',
                        operator: 'between',
                        value: ['2026-01-01', '2026-12-31'],
                    },
                    { entity: 'cases', field: 'ans_pos', operator: 'eq', value: 'invalid' },
                ],
            },
            { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
        ];
        const result = BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(result).toEqual([{ entity: 'cases', field: 'status', operator: 'eq', value: 'open' }]);
    });

    it('handles nested groups', () => {
        const filters = [
            {
                groupType: 'AND',
                filters: [
                    {
                        groupType: 'OR',
                        filters: [
                            {
                                entity: 'cases',
                                field: 'ans_posicion',
                                operator: 'between',
                                value: ['2026-01-01', '2026-12-31'],
                            },
                        ],
                    },
                    { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
                ],
            },
        ];
        const result = BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(result).toEqual([
            {
                groupType: 'AND',
                filters: [{ entity: 'cases', field: 'status', operator: 'eq', value: 'open' }],
            },
        ]);
    });

    it('keeps the valid quick ans filter alongside an invalid sibling inside a nested group', () => {
        const filters = [
            {
                groupType: 'AND',
                filters: [
                    {
                        groupType: 'OR',
                        filters: [
                            { entity: 'cases', field: 'ans_pos', operator: 'eq', value: 1 },
                            {
                                entity: 'cases',
                                field: 'ans_posicion',
                                operator: 'between',
                                value: ['2026-01-01', '2026-12-31'],
                            },
                        ],
                    },
                    { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
                ],
            },
        ];
        const result = BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(result).toEqual([
            {
                groupType: 'AND',
                filters: [
                    {
                        groupType: 'OR',
                        filters: [{ entity: 'cases', field: 'ans_pos', operator: 'eq', value: 1 }],
                    },
                    { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
                ],
            },
        ]);
    });

    it('does not mutate the input filters array', () => {
        const filters = [
            { entity: 'cases', field: 'ans_posicion', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
            { entity: 'cases', field: 'status', operator: 'eq', value: 'open' },
        ];
        const snapshot = JSON.parse(JSON.stringify(filters));
        BoardAnsFilterPolicy.stripFilters(filters, ansSelect);
        expect(filters).toEqual(snapshot);
    });
});
