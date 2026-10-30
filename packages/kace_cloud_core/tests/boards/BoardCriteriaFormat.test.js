import { BoardCriteriaFormat } from '../../src/boards/domain/BoardCriteriaFormat.js';
import { ALLOWED_CRITERIA_FUNCTIONS } from '../../src/shared/criteria/allowedCriteriaFunctions.js';

describe('BoardCriteriaFormat - buildSelectColumns', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should build simple select columns without alias', () => {
        const select = [
            { entity: 'cases', field: 'id' },
            { entity: 'cases', field: 'title' },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['cases.id', 'cases.title']);
    });

    it('should build select columns with alias', () => {
        const select = [
            { entity: 'cases', field: 'id', alias: 'case_id' },
            { entity: 'cases', field: 'title', alias: 'case_title' },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['cases.id as case_id', 'cases.title as case_title']);
    });

    it('should build select columns with aggregate functions', () => {
        const select = [{ entity: 'cases', field: 'id', function: 'COUNT', alias: 'total_cases' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual([
            {
                function: 'COUNT',
                alias: 'total_cases',
                field: 'cases.id',
            },
        ]);
    });

    it('should build select columns with DATE_DIFFERENCE comparison function', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual([
            {
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                field: 'cases.created_at ::: NOW()',
            },
        ]);

        expect(formatter.getFormatters()).toEqual([
            { function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE, alias: 'time_diff' },
        ]);
    });

    it('should build DATE_DIFFERENCE with FIELD comparison type', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'FIELD',
                comparison_entity: 'cases',
                comparison_field: 'updated_at',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual([
            {
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                field: 'cases.created_at ::: cases.updated_at',
            },
        ]);
    });

    it('should build DATE_DIFFERENCE with auxiliary field comparison', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'FIELD',
                comparison_entity: 'aux_cases',
                comparison_field: 'custom.date_field',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain("aux_cases.data -> 'custom' ->> 'date_field'");
        expect(result[0].field).toContain('CASE WHEN');
        expect(result[0].field).toContain('::timestamptz');
    });

    it('should build DATE_DIFFERENCE with timestamp value', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: '2024-01-01',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual([
            {
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                field: "cases.created_at ::: '2024-01-01'::timestamptz",
            },
        ]);
    });

    it('should build DATE_DIFFERENCE with user specific nested JSON field', () => {
        const select = [
            {
                alias: 'tiempo_de_contacto',
                field: 'asistencia_movilidad.gestion_proveedor_asistencia_movilidad_detail.fecha_y_hora_monitoreo_en_sitio',
                entity: 'case_auxiliar',
                format: null,
                function: 'date_difference',
                group_by: false,
                position: 2,
                data_type: 'DATE',
                function_type: 'comparison',
                is_filterable: false,
                comparison_type: 'now',
                comparison_value: 'NOW',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain(
            "case_auxiliar.data -> 'asistencia_movilidad' -> 'gestion_proveedor_asistencia_movilidad_detail' ->> 'fecha_y_hora_monitoreo_en_sitio'"
        );
        expect(result[0].field).toContain('CASE WHEN');
        expect(result[0].field).toContain('::timestamptz');
        expect(result[0].field).toContain('::: NOW()');
        expect(result[0].alias).toBe('tiempo_de_contacto');
    });

    it('should use timestamptz (not timestamp) in all date_difference casts to avoid timezone drift', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'form.fecha_inicio',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'diff_json_vs_field',
                comparison_type: 'FIELD',
                comparison_entity: 'case_auxiliar',
                comparison_field: 'form.fecha_fin',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        const parts = result[0].field.split('::: ');
        expect(parts).toHaveLength(2);

        expect(parts[0]).toContain('::timestamptz');
        expect(parts[1]).toContain('::timestamptz');
    });
});

describe('BoardCriteriaFormat - buildRelationships', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should build simple relationships', () => {
        const relations = [
            {
                related_entity: 'users',
                alias: 'u',
                join_type: 'LEFT',
                on: [{ left: 'cases.created_by', right: 'u.id' }],
            },
        ];

        const result = formatter.buildRelationships(relations);

        expect(result).toEqual([
            {
                table: 'users as u',
                type: 'left',
                condition: {
                    column: 'cases.created_by',
                    refColumn: 'u.id',
                },
            },
        ]);
    });

    it('should build nested relationships', () => {
        const relations = [
            {
                related_entity: 'users',
                alias: 'u',
                join_type: 'LEFT',
                on: [{ left: 'cases.created_by', right: 'u.id' }],
                relations: [
                    {
                        related_entity: 'groups',
                        alias: 'g',
                        join_type: 'INNER',
                        on: [{ left: 'u.group_id', right: 'g.id' }],
                    },
                ],
            },
        ];

        const result = formatter.buildRelationships(relations);

        expect(result).toEqual([
            {
                table: 'users as u',
                type: 'left',
                condition: {
                    column: 'cases.created_by',
                    refColumn: 'u.id',
                },
            },
            {
                table: 'groups as g',
                type: 'inner',
                condition: {
                    column: 'u.group_id',
                    refColumn: 'g.id',
                },
            },
        ]);
    });

    it('should return empty array when no relationships provided', () => {
        const result = formatter.buildRelationships([]);

        expect(result).toEqual([]);
    });

    it('should default to LEFT join when join_type is not specified', () => {
        const relations = [
            {
                related_entity: 'users',
                alias: 'u',
                on: [{ left: 'cases.created_by', right: 'u.id' }],
            },
        ];

        const result = formatter.buildRelationships(relations);

        expect(result[0].type).toBe('left');
    });
});

describe('BoardCriteriaFormat - buildFilters', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should build simple filters', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'status',
                operator: '=',
                type: 'and',
                value: 'open',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: 'cases.status',
                operator: '=',
                type: 'and',
                value: 'open',
            },
        ]);
    });

    it('should build filters with function_type', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: '>',
                type: 'and',
                function_type: 'DATE',
                value: '2024-01-01',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: 'cases.created_at',
                operator: '>',
                type: 'and',
                value: {
                    function: 'DATE',
                    value: '2024-01-01',
                },
            },
        ]);
    });

    it('should return empty array when filters is null', () => {
        const result = formatter.buildFilters(null);

        expect(result).toEqual([]);
    });

    it('should normalize single filter object to array', () => {
        const filter = {
            entity: 'cases',
            field: 'status',
            operator: '=',
            type: 'and',
            value: 'open',
        };

        const result = formatter.buildFilters(filter);

        expect(result).toHaveLength(1);
        expect(result[0].field).toBe('cases.status');
    });
});

describe('BoardCriteriaFormat - buildHavings', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should build simple having clauses', () => {
        const having = [
            {
                field: 'count',
                operator: '>',
                value: 5,
            },
        ];

        const result = formatter.buildHavings(having);

        expect(result).toEqual([
            {
                operator: '>',
                column: 'count',
                value: 5,
            },
        ]);
    });

    it('should build having clauses with functions', () => {
        const having = [
            {
                entity: 'cases',
                field: 'id',
                function: 'COUNT',
                operator: '>',
                value: 10,
            },
        ];

        const result = formatter.buildHavings(having);

        expect(result).toEqual([
            {
                operator: '>',
                column: 'COUNT(cases.id)',
                value: 10,
            },
        ]);
    });

    it('should build having clauses for auxiliary tables with JSON fields', () => {
        const having = [
            {
                entity: 'aux_cases',
                field: 'custom_field',
                function: 'COUNT',
                operator: '>',
                value: 5,
            },
        ];

        const result = formatter.buildHavings(having);

        expect(result).toEqual([
            {
                operator: '>',
                column: "COUNT(aux_cases.data #>> '{custom_field}')",
                value: 5,
            },
        ]);
    });

    it('should not treat aux_definitions as auxiliary table', () => {
        const having = [
            {
                entity: 'aux_definitions',
                field: 'name',
                function: 'COUNT',
                operator: '>',
                value: 5,
            },
        ];

        const result = formatter.buildHavings(having);

        expect(result).toEqual([
            {
                operator: '>',
                column: 'COUNT(aux_definitions.name)',
                value: 5,
            },
        ]);
    });
    it('should correctly split between filter values for main entity', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: '2025-12-10T00:00:00.000Z, 2026-01-10T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: 'cases.created_at',
                operator: 'between',
                type: 'AND',
                value: ['2025-12-10T00:00:00.000Z', '2026-01-10T23:59:59.999Z'],
            },
        ]);
    });
    it('should correctly split between filter values for auxiliary entity', () => {
        const filters = [
            {
                entity: 'case_auxiliar',
                field: 'creacionform',
                operator: 'between',
                type: 'AND',
                value: '2025-12-10T00:00:00.000Z, 2026-01-10T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: expect.stringContaining('case_auxiliar.creacionform'),
                operator: 'between',
                type: 'AND',
                value: ['2025-12-10T00:00:00.000Z', '2026-01-10T23:59:59.999Z'],
            },
        ]);
    });

    it('should not duplicate entity as a JSON key when field is entity-prefixed (single level)', () => {
        const filters = [
            {
                entity: 'case_auxiliar',
                field: 'case_auxiliar.creacionform',
                operator: 'between',
                type: 'AND',
                value: '2026-05-06T00:00:00.000Z, 2026-05-15T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result[0].field).toBe("case_auxiliar.data ->> 'creacionform'");
        expect(result[0].field).not.toContain("-> 'case_auxiliar'");
        expect(result[0].value).toEqual(['2026-05-06T00:00:00.000Z', '2026-05-15T23:59:59.999Z']);
    });

    it('should not duplicate entity as a JSON key when field is entity-prefixed (nested path)', () => {
        const filters = [
            {
                entity: 'case_auxiliar',
                field: 'case_auxiliar.form1.fecha',
                operator: 'between',
                type: 'AND',
                value: '2026-05-06T00:00:00.000Z, 2026-05-15T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result[0].field).toBe("case_auxiliar.data -> 'form1' ->> 'fecha'");
        expect(result[0].field).not.toContain("-> 'case_auxiliar'");
    });

    it('should produce correct JSON expression when field has no entity prefix (normal case)', () => {
        const filters = [
            {
                entity: 'case_auxiliar',
                field: 'form1.fecha',
                operator: 'between',
                type: 'AND',
                value: '2026-05-06T00:00:00.000Z, 2026-05-15T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result[0].field).toBe("case_auxiliar.data -> 'form1' ->> 'fecha'");
    });

    it('should correctly build between filter for nested JSON field in auxiliary entity', () => {
        const filters = [
            {
                entity: 'case_auxiliar',
                field: 'form1.created_at',
                operator: 'between',
                type: 'AND',
                value: '2026-02-01T00:00:00.000Z,2026-02-28T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toHaveLength(1);

        const filter = result[0];

        expect(filter.field).toContain("case_auxiliar.data -> 'form1' ->> 'created_at");
        expect(filter.operator).toBe('between');

        expect(filter.value).toEqual(['2026-02-01T00:00:00.000Z', '2026-02-28T23:59:59.999Z']);
    });

    it('should not transform normal entity fields', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: '2026-02-01T00:00:00.000Z,2026-02-28T23:59:59.999Z',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result[0].field).toBe('cases.created_at');
    });

    it('should always return array for between operator', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: 'A, B',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(Array.isArray(result[0].value)).toBe(true);
        expect(result[0].value).toHaveLength(2);
    });

    it('should keep between values as array if already provided', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: ['2025-12-10', '2026-01-10'],
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: 'cases.created_at',
                operator: 'between',
                type: 'AND',
                value: ['2025-12-10', '2026-01-10'],
            },
        ]);
    });

    it('should handle invalid between value gracefully when only one value is provided', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: '2025-12-10',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result[0].value).toEqual(['2025-12-10']);
    });
    it('should trim values when splitting between filter', () => {
        const filters = [
            {
                entity: 'cases',
                field: 'created_at',
                operator: 'between',
                type: 'AND',
                value: ' 2025-12-10T00:00:00.000Z ,   2026-01-10T23:59:59.999Z ',
            },
        ];

        const result = formatter.buildFilters(filters);

        expect(result).toEqual([
            {
                field: 'cases.created_at',
                operator: 'between',
                type: 'AND',
                value: ['2025-12-10T00:00:00.000Z', '2026-01-10T23:59:59.999Z'],
            },
        ]);
    });
});
describe('BoardCriteriaFormat - formatRows', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should return rows unchanged when no formatters are set', () => {
        const rows = [
            { id: 1, name: 'Test' },
            { id: 2, name: 'Test 2' },
        ];

        const result = formatter.formatRows(rows);

        expect(result).toEqual(rows);
    });

    it('should format date difference in seconds to human-readable format', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        formatter.buildSelectColumns(select);

        const rows = [
            { id: 1, time_diff: 90061 },
            { id: 2, time_diff: 3661 },
        ];

        formatter.formatRows(rows);

        expect(rows[0].time_diff).toBe('1 días → 1 horas → 1 minutos');
        expect(rows[1].time_diff).toBe('0 días → 1 horas → 1 minutos');
    });

    it('should handle negative date differences', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        formatter.buildSelectColumns(select);

        const rows = [{ id: 1, time_diff: -90061 }];

        formatter.formatRows(rows);

        expect(rows[0].time_diff).toBe('-1 días → -1 horas → -1 minutos');
    });

    it('should handle null values in date difference', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        formatter.buildSelectColumns(select);

        const rows = [
            { id: 1, time_diff: null },
            { id: 2, time_diff: undefined },
        ];

        formatter.formatRows(rows);

        expect(rows[0].time_diff).toBeNull();
        expect(rows[1].time_diff).toBeNull();
    });

    it('should format multiple rows with different time_diff values', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];
        formatter.buildSelectColumns(select);

        const rows = [
            { id: 1, time_diff: 86400 },
            { id: 2, time_diff: 3600 },
            { id: 3, time_diff: 60 },
            { id: 4, time_diff: 0 },
        ];

        formatter.formatRows(rows);

        expect(rows[0].time_diff).toBe('1 días → 0 horas → 0 minutos');
        expect(rows[1].time_diff).toBe('0 días → 1 horas → 0 minutos');
        expect(rows[2].time_diff).toBe('0 días → 0 horas → 1 minutos');
        expect(rows[3].time_diff).toBe('0 días → 0 horas → 0 minutos');
    });
});

describe('BoardCriteriaFormat - getFormatters', () => {
    it('should return empty array initially', () => {
        const formatter = new BoardCriteriaFormat();

        expect(formatter.getFormatters()).toEqual([]);
    });

    it('should return formatters after building select columns with DATE_DIFFERENCE', () => {
        const formatter = new BoardCriteriaFormat();
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];

        formatter.buildSelectColumns(select);

        expect(formatter.getFormatters()).toEqual([
            { function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE, alias: 'time_diff' },
        ]);
    });
});

describe('BoardCriteriaFormat - JSON array key extraction (aux tables)', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should keep full path and register JSON_ARRAY_KEY_EXTRACT formatter', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_listas.edit_groups.label as edit_groups_label']);

        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'edit_groups_label', jsonKey: 'label' },
        ]);
    });

    it('should extract label from a parsed array of objects', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        formatter.buildSelectColumns(select);

        const rows = [
            {
                edit_groups_label: [
                    { label: 'Usuario virtual', value: '28ac69b3' },
                    { label: 'Proveedor', value: '6b87790a' },
                ],
            },
        ];

        formatter.formatRows(rows);

        expect(rows[0].edit_groups_label).toBe('Usuario virtual, Proveedor');
    });

    it('should extract label from a JSON string (as returned by some DB drivers)', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        formatter.buildSelectColumns(select);

        const rows = [
            {
                edit_groups_label: JSON.stringify([
                    { label: 'Usuario virtual', value: '28ac69b3' },
                    { label: 'Proveedor', value: '6b87790a' },
                ]),
            },
        ];

        formatter.formatRows(rows);

        expect(rows[0].edit_groups_label).toBe('Usuario virtual, Proveedor');
    });

    it('should return null when the field value is null', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        formatter.buildSelectColumns(select);

        const rows = [{ edit_groups_label: null }];
        formatter.formatRows(rows);

        expect(rows[0].edit_groups_label).toBeNull();
    });

    it('should return null when the array has no elements with the key', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        formatter.buildSelectColumns(select);

        const rows = [{ edit_groups_label: [{ value: 'only-value' }, { value: 'no-label' }] }];
        formatter.formatRows(rows);

        expect(rows[0].edit_groups_label).toBeNull();
    });

    it('should handle a single object (not an array) and extract the key', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        formatter.buildSelectColumns(select);

        const rows = [{ edit_groups_label: { label: 'Solo grupo' } }];
        formatter.formatRows(rows);

        expect(rows[0].edit_groups_label).toBe('Solo grupo');
    });

    it('should auto-generate alias when none is provided', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_listas.edit_groups.label as aux_listas_edit_groups_label']);
        expect(formatter.getFormatters()[0].alias).toBe('aux_listas_edit_groups_label');
    });

    it('should handle three-level path: object → array → key', () => {
        const select = [{ entity: 'aux_cases', field: 'form1.form2.label', alias: 'arraylabel' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_cases.form1.form2.label as arraylabel']);

        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'arraylabel', jsonKey: 'label' },
        ]);
    });

    it('should extract labels from a three-level path after formatRows', () => {
        const select = [{ entity: 'aux_cases', field: 'form1.form2.label', alias: 'arraylabel' }];
        formatter.buildSelectColumns(select);

        const rows = [
            {
                arraylabel: [
                    { label: 'Medellin', value: 'medellin' },
                    { label: 'Santa Fe de Antioquia', value: 'santa_fe_antioquia' },
                ],
            },
        ];

        formatter.formatRows(rows);

        expect(rows[0].arraylabel).toBe('Medellin, Santa Fe de Antioquia');
    });

    it('should NOT apply JSON_ARRAY_KEY_EXTRACT to aux- prefix entities (not supported)', () => {
        const select = [{ entity: 'aux-contactos', field: 'phones.number', alias: 'phone_numbers' }];

        formatter.buildSelectColumns(select);

        expect(formatter.getFormatters()).toHaveLength(0);
    });

    it('should apply JSON_ARRAY_KEY_EXTRACT to case_auxiliar (alias of aux_cases)', () => {
        const select = [{ entity: 'case_auxiliar', field: 'tags.name', alias: 'tag_names' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['case_auxiliar.tags.name as tag_names']);
        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'tag_names', jsonKey: 'name' },
        ]);
    });

    it('should apply JSON_ARRAY_KEY_EXTRACT to clients_auxiliar (alias of aux_clients)', () => {
        const select = [{ entity: 'clients_auxiliar', field: 'edit_groups.label', alias: 'edit_groups_label' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['clients_auxiliar.edit_groups.label as edit_groups_label']);
        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'edit_groups_label', jsonKey: 'label' },
        ]);
    });

    it('should not apply JSON_ARRAY_KEY_EXTRACT to non-aux entities with dots in field', () => {
        const select = [{ entity: 'cases', field: 'some.dotted.field', alias: 'my_alias' }];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['cases.some.dotted.field as my_alias']);
        expect(formatter.getFormatters()).toHaveLength(0);
    });

    it('should not affect existing DATE_DIFFERENCE formatters when combined', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
            { entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' },
        ];

        formatter.buildSelectColumns(select);

        const rows = [
            {
                time_diff: 3661,
                edit_groups_label: [{ label: 'Admin' }, { label: 'User' }],
            },
        ];

        formatter.formatRows(rows);

        expect(rows[0].time_diff).toBe('0 días → 1 horas → 1 minutos');
        expect(rows[0].edit_groups_label).toBe('Admin, User');
    });

    it('should use column for aux entity with created_at', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'created_at',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_cases.created_at']);
    });

    it('should use column for aux entity created_at in DATE_DIFFERENCE', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain('aux_cases.created_at');
        expect(result[0].field).not.toContain('data');
    });

    it('should use column for aux entity with updated_at', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'updated_at',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_cases.updated_at']);
    });
    it('should use column for aux entity with updated_at and alias', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'updated_at',
                alias: 'updated_date',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual(['aux_cases.updated_at as updated_date']);
    });

    it('should use column for aux entity updated_at in DATE_DIFFERENCE', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'updated_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain('aux_cases.updated_at');
        expect(result[0].field).not.toContain('data');
    });

    it('should use column when comparison_field is updated_at in aux entity', () => {
        const select = [
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'time_diff',
                comparison_type: 'FIELD',
                comparison_entity: 'aux_cases',
                comparison_field: 'updated_at',
            },
        ];

        const result = formatter.buildSelectColumns(select);
        expect(result[0].field).toContain('aux_cases.updated_at');
        expect(result[0].field).not.toContain('data');
    });

    it('should correctly handle created_at and updated_at in DATE_DIFFERENCE', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'diff_created',
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
            {
                entity: 'cases',
                field: 'created_at',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                alias: 'diff_updated',
                comparison_type: 'FIELD',
                comparison_entity: 'aux_cases',
                comparison_field: 'updated_at',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain('aux_cases.created_at');
        expect(result[0].field).not.toContain('data');

        expect(result[1].field).toContain('aux_cases.updated_at');
        expect(result[1].field).not.toContain('data');
    });
});

describe('BoardCriteriaFormat - is_filterable + data_type for scalar vs array JSONB fields', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should use full path when is_filterable is false (STRING)', () => {
        const select = [
            {
                entity: 'aux_listas',
                field: 'edit_groups.label',
                alias: 'edit_groups_label',
                is_filterable: false,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_listas.edit_groups.label as edit_groups_label']);
    });

    it('should use full path when is_filterable is not set', () => {
        const select = [{ entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label' }];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_listas.edit_groups.label as edit_groups_label']);
    });

    it('should use full path for filterable STRING', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'persona.departamento.label',
                alias: 'departamento_label',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual([
            'case_auxiliar.persona.departamento.label as departamento_label',
        ]);
    });

    it('should use full path for filterable STRING two-level scalar key', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'pruebaDM.ciudad',
                alias: 'ciudad',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['case_auxiliar.pruebaDM.ciudad as ciudad']);
    });

    it('should use full path when is_filterable is true even if data_type is not set', () => {
        const select = [
            { entity: 'aux_listas', field: 'edit_groups.label', alias: 'edit_groups_label', is_filterable: true },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_listas.edit_groups.label as edit_groups_label']);
    });

    it('should use full path for filterable DATE (scalar object field)', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'form1.created_at',
                alias: 'createat',
                is_filterable: true,
                data_type: 'DATE',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['case_auxiliar.form1.created_at as createat']);
    });

    it('should use full path for filterable NUMBER', () => {
        const select = [
            { entity: 'case_auxiliar', field: 'form1.age', alias: 'edad', is_filterable: true, data_type: 'NUMBER' },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['case_auxiliar.form1.age as edad']);
    });

    it('should use full path for filterable DATE with three-level object path', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'pruebaDM.fecha_solicitud',
                alias: 'fecha',
                is_filterable: true,
                data_type: 'DATE',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['case_auxiliar.pruebaDM.fecha_solicitud as fecha']);
    });

    it('should use full path for filterable DATE on aux_ prefixed entity', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'info.created_at',
                alias: 'creado',
                is_filterable: true,
                data_type: 'DATE',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_proveedores.info.created_at as creado']);
    });

    it('should always register JSON_ARRAY_KEY_EXTRACT formatter when using full path', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'form1.created_at',
                alias: 'createat',
                is_filterable: true,
                data_type: 'DATE',
            },
        ];
        formatter.buildSelectColumns(select);
        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'createat', jsonKey: 'created_at' },
        ]);
    });

    it('should use full path for non-filterable three-level path', () => {
        const select = [{ entity: 'aux_cases', field: 'form1.form2.label', alias: 'arraylabel', is_filterable: false }];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_cases.form1.form2.label as arraylabel']);
    });

    it('should use full path for filterable STRING aux non-primary (servicios_especiales)', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'asistencia_movilidad.servicios_especiales',
                alias: 'servicios_especiales',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual([
            'case_auxiliar.asistencia_movilidad.servicios_especiales as servicios_especiales',
        ]);
        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'servicios_especiales', jsonKey: 'servicios_especiales' },
        ]);
    });

    it('should use full path for filterable dotted aux field with array payload', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'tipo.value',
                alias: 'tipo',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['aux_proveedores.tipo.value as tipo']);
        expect(formatter.getFormatters()).toEqual([
            { function: 'JSON_ARRAY_KEY_EXTRACT', alias: 'tipo', jsonKey: 'value' },
        ]);
    });

    it('should use full path for mixed filterable array keys and scalar keys', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'pruebaDM.ciudad',
                alias: 'ciudad',
                is_filterable: true,
                data_type: 'STRING',
            },
            {
                entity: 'aux_proveedores',
                field: 'tipo.value',
                alias: 'tipo',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual([
            'case_auxiliar.pruebaDM.ciudad as ciudad',
            'aux_proveedores.tipo.value as tipo',
        ]);
    });

    it('should leave scalar value unchanged in formatRows when value is not JSON', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'asistencia_movilidad.servicios_especiales',
                alias: 'servicios_especiales',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        formatter.buildSelectColumns(select);
        const rows = [{ servicios_especiales: 'GUARDIANES URBANOS' }];
        formatter.formatRows(rows);
        expect(rows[0].servicios_especiales).toBe('GUARDIANES URBANOS');
    });

    it('should extract array item value in formatRows for filterable dotted aux field', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'tipo.value',
                alias: 'tipo',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        formatter.buildSelectColumns(select);
        const rows = [{ tipo: '[{"value":"Felipe"}]' }];
        formatter.formatRows(rows);
        expect(rows[0].tipo).toBe('Felipe');
    });

    it('should extract object value in formatRows for filterable dotted aux field', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'tipo.value',
                alias: 'tipo',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        formatter.buildSelectColumns(select);
        const rows = [{ tipo: '{"value":"Felipe"}' }];
        formatter.formatRows(rows);
        expect(rows[0].tipo).toBe('Felipe');
    });

    it('should preserve null in formatRows for filterable dotted aux field', () => {
        const select = [
            {
                entity: 'aux_proveedores',
                field: 'tipo.value',
                alias: 'tipo',
                is_filterable: true,
                data_type: 'STRING',
            },
        ];
        formatter.buildSelectColumns(select);
        const rows = [{ tipo: null }];
        formatter.formatRows(rows);
        expect(rows[0].tipo).toBeNull();
    });

    it('should use full path for non-filterable dotted aux field (non-regression for JSONB arrays)', () => {
        const select = [
            {
                entity: 'case_auxiliar',
                field: 'edit_groups.label',
                alias: 'edit_groups_label',
                is_filterable: false,
                data_type: 'STRING',
            },
        ];
        expect(formatter.buildSelectColumns(select)).toEqual(['case_auxiliar.edit_groups.label as edit_groups_label']);
    });

    it('should work with is_filterable in DATE_DIFFERENCE combination', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: 'form1.timestamp',
                alias: 'time_diff',
                function: ALLOWED_CRITERIA_FUNCTIONS.compartion_functions.DATE_DIFFERENCE,
                is_filterable: true,
                comparison_type: 'VALUE',
                comparison_value: 'NOW',
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain("aux_cases.data -> 'form1' ->> 'timestamp'");
        expect(result[0].field).toContain('CASE WHEN');
    });
});

describe('BoardCriteriaFormat - buildSelectColumns with CONCAT function', () => {
    let formatter;

    beforeEach(() => {
        formatter = new BoardCriteriaFormat();
    });

    it('should return object with function, alias and interleaved field expression', () => {
        const select = [
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                separator: ' ',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result).toEqual([
            {
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                field: "usuarios.nombres, ' ', usuarios.apellido1",
            },
        ]);
    });

    it('should interleave separator between three sources', () => {
        const select = [
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                separator: ' ',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                    { entity: 'usuarios', field: 'apellido2' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toBe("usuarios.nombres, ' ', usuarios.apellido1, ' ', usuarios.apellido2");
    });

    it('should use comma separator', () => {
        const select = [
            {
                entity: 'cases',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'datos',
                separator: ', ',
                concat_sources: [
                    { entity: 'cases', field: 'id' },
                    { entity: 'cases', field: 'external_code' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toBe("cases.id, ', ', cases.external_code");
    });

    it('should use empty separator', () => {
        const select = [
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'codigo',
                separator: '',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toBe("usuarios.nombres, '', usuarios.apellido1");
    });

    it('should default to space separator when separator is not provided', () => {
        const select = [
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain("' '");
    });

    it('should not register any formatter entry for CONCAT', () => {
        const select = [
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                separator: ' ',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                ],
            },
        ];

        formatter.buildSelectColumns(select);

        expect(formatter.getFormatters()).toHaveLength(0);
    });

    it('should resolve simple aux field (no dot) in concat_sources to jsonb data expression', () => {
        const select = [
            {
                entity: 'aux_param_destinatarios_alertas',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'concatenado',
                separator: ' ',
                concat_sources: [
                    { entity: 'aux_param_destinatarios_alertas', field: 'nombre' },
                    { entity: 'aux_param_destinatarios_alertas', field: 'linea.label' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toBe(
            "aux_param_destinatarios_alertas.data ->> 'nombre', ' ', aux_param_destinatarios_alertas.data -> 'linea' ->> 'label'"
        );
    });

    it('should not resolve column fields (created_at, updated_at) as jsonb in concat_sources', () => {
        const select = [
            {
                entity: 'aux_cases',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'info',
                separator: ' ',
                concat_sources: [
                    { entity: 'aux_cases', field: 'nombre' },
                    { entity: 'aux_cases', field: 'created_at' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0].field).toContain("aux_cases.data ->> 'nombre'");
        expect(result[0].field).toContain('aux_cases.created_at');
        expect(result[0].field).not.toContain("data ->> 'created_at'");
    });

    it('should handle CONCAT mixed with regular and aggregate columns', () => {
        const select = [
            { entity: 'cases', field: 'responsable_id', alias: 'resp_id', group_by: true },
            { entity: 'cases', field: 'id', alias: 'total', function: 'count' },
            {
                entity: 'usuarios',
                field: '',
                function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
                alias: 'nombre_completo',
                separator: ' ',
                concat_sources: [
                    { entity: 'usuarios', field: 'nombres' },
                    { entity: 'usuarios', field: 'apellido1' },
                ],
            },
        ];

        const result = formatter.buildSelectColumns(select);

        expect(result[0]).toBe('cases.responsable_id as resp_id');
        expect(result[1]).toMatchObject({ function: 'count', alias: 'total', field: 'cases.id' });
        expect(result[2]).toMatchObject({
            function: ALLOWED_CRITERIA_FUNCTIONS.concat_functions.CONCAT,
            alias: 'nombre_completo',
        });
    });
});
