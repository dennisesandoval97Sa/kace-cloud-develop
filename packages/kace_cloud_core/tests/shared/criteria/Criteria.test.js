import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Test for criteria', () => {
    let repository;

    beforeAll(() => {
        repository = new KnexRepository(knexConfig);
    });

    test('should return criteria instance', () => {
        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'in',
                value: 'bg-green-300/20',
                type: 'and',
            },
        ];
        const relationship = [];
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const criteria = new Criteria(filters, relationship, limit, offset, order, 'ans');

        expect(criteria).toBeInstanceOf(Criteria);
    });

    test('should return criteria instance with relationships', async () => {
        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'in',
                value: 'bg-green-300/20',
                type: 'and',
            },
        ];
        const relationship = [
            {
                table: 'clasificaciones',
                condition: {
                    column: 'clasificaciones.ans_id',
                    refColumn: 'ans.id',
                },
                type: 'join',
            },
        ];
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const criteria = new Criteria(filters, relationship, limit, offset, order, 'ans');

        expect(criteria).toBeInstanceOf(Criteria);
    });

    test('should return criteria instance with order by', () => {
        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'in',
                value: 'bg-green-300/20',
                type: 'and',
            },
        ];
        const relationship = [];
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const criteria = new Criteria(filters, relationship, limit, offset, order, 'ans');

        expect(criteria).toBeInstanceOf(Criteria);
    });

    test('can use a criteria instance with out filter or relationship', async () => {
        const filters = undefined;
        const relationship = undefined;
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const criteria = new Criteria(filters, relationship, limit, offset, order, 'ans');

        expect(criteria).toBeInstanceOf(Criteria);
    });

    test('converter should match with a Knex query', async () => {
        const query = repository
            .connection('usuarios')
            .select('*')
            .where('usuarios.id', 1)
            .limit(10)
            .offset(5)
            .orderBy('usuarios.id', 'asc')
            .toQuery();

        const filters = [
            {
                field: 'id',
                operator: 'eq',
                value: 1,
                type: 'and',
            },
        ];
        const relationship = undefined;
        const limit = 10;
        const offset = 5;
        const order = {
            field: 'id',
            direction: 'asc',
        };
        const criteria = new Criteria(filters, relationship, limit, offset, order, 'usuarios');

        const queryFromCriteria = criteria.convertToKnex(repository.connection('usuarios').select('*'));
        expect(queryFromCriteria.toQuery()).toEqual(query);
    });

    test('should allow select only from base and joined tables', async () => {
        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];

        const selectFields = ['ans.id', 'clasificaciones.created_at'];

        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields);

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));
        const sql = query.toSQL().sql;

        expect(sql).toContain('"ans"."id"');
        expect(sql).toContain('"clasificaciones"."created_at"');
    });

    test('should throw error when selecting from unrelated table', () => {
        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];

        expect(() => {
            new Criteria(null, relationship, null, null, null, 'ans', ['usuarios.id']);
        }).toThrow(/is not part of the allowed relationships/);
    });

    test('should apply group by only if select and groupBy are defined', async () => {
        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];

        const selectFields = ['ans.id', 'clasificaciones.created_at', 'ans.intermedio', 'clasificaciones.nivel1'];
        const groupBy = ['ans.id', 'clasificaciones.created_at'];

        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields, groupBy, null);
        const query = criteria.convertToKnex(repository.connection('ans').select('*'));
        const sql = query.toSQL().sql;

        expect(sql).toContain('group by');
        expect(sql).toContain('"ans"."id"');
    });

    test('should throw error if grouping by table not in relationships', () => {
        const selectFields = ['ans.id'];
        const groupBy = ['usuarios.id'];
        expect(() => {
            new Criteria(null, null, null, null, null, 'ans', selectFields, groupBy, null);
        }).toThrow(/is not part of the allowed relationships/);
    });

    test('should return criteria instance without having if it does not have agrupations', async () => {
        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'in',
                value: 'bg-green-300/20',
                type: 'and',
            },
        ];
        const relationship = [];
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const havingConditions = [
            { column: 'count', operator: 'gt', value: 5 },
            { column: 'sum_amount', operator: 'gte', value: 1000 },
        ];

        const criteria = new Criteria(filters, relationship, limit, offset, order, 'ans', null, null, havingConditions);

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));

        expect(criteria).toBeInstanceOf(Criteria);
        expect(query.toSQL().sql).not.toContain('having');
        expect(query.toSQL().sql).not.toContain('count');
        expect(query.toSQL().sql).not.toContain('sum_amount');
    });

    test('should return criteria instance with having', async () => {
        const filters = [
            {
                field: 'color_ans_inicial',
                operator: 'in',
                value: 'bg-green-300/20',
                type: 'and',
            },
        ];
        const relationship = [];
        const limit = 100;
        const offset = 0;
        const order = {
            field: 'color_ans_inicial',
            direction: 'asc',
        };

        const havingConditions = [{ column: 'ans.created_at', operator: 'notNull', value: null }];

        const selectFields = ['ans.id', 'ans.created_at'];
        const groupBy = ['ans.created_at'];

        const criteria = new Criteria(
            filters,
            relationship,
            limit,
            offset,
            order,
            'ans',
            selectFields,
            groupBy,
            havingConditions
        );

        const query = criteria.convertToKnex(repository.connection('ans').select('*'));

        expect(criteria).toBeInstanceOf(Criteria);
        expect(query.toSQL().sql).toContain('having');
    });

    test('should apply custom select fields in criteria', async () => {
        const selectFields = ['ans.id', 'ans.intermedio', 'ans.created_at'];

        const criteria = new Criteria(null, null, null, null, null, 'ans', selectFields);

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql;

        expect(sql).toContain('select');
        expect(sql).toContain('"ans"."id"');
        expect(sql).toContain('"ans"."created_at"');
        expect(sql).not.toContain('select *');
    });

    test('should apply distinct true on select fields', async () => {
        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];

        const distinct = true;
        const selectFields = ['ans.id', 'clasificaciones.created_at'];
        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields, null, null, distinct);

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).toContain('select distinct');
        expect(sql).toContain('"ans"."id"');
        expect(sql).toContain('"clasificaciones"."created_at"');
    });

    test('should not apply distinct when distinct is false', async () => {
        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];
        const distinct = false;

        const selectFields = ['ans.id', 'clasificaciones.created_at'];
        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields, null, null, distinct);

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).not.toContain('select distinct');
        expect(sql.toLowerCase()).toContain('select');
    });

    test('should build full query with all features (filters, joins, order, groupBy, having, limit, offset, distinct)', async () => {
        const filters = [
            {
                field: 'ans.id',
                operator: 'eq',
                value: 1,
                type: 'and',
            },
        ];

        const relationship = [
            {
                table: 'clasificaciones',
                condition: { column: 'clasificaciones.ans_id', refColumn: 'ans.id' },
                type: 'join',
            },
        ];

        const order = {
            field: 'ans.created_at',
            direction: 'desc',
        };

        const selectFields = ['ans.id', 'clasificaciones.created_at', 'ans.intermedio'];
        const groupBy = ['clasificaciones.created_at'];
        const having = [{ column: 'clasificaciones.created_at', operator: 'notNull', value: null }];

        const limit = 20;
        const offset = 10;

        const distinct = false;
        const criteria = new Criteria(
            filters,
            relationship,
            limit,
            offset,
            order,
            'ans',
            selectFields,
            groupBy,
            having,
            distinct
        );

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).toContain('select');
        expect(sql.toLowerCase()).toContain('join');
        expect(sql.toLowerCase()).toContain('where');
        expect(sql.toLowerCase()).toContain('group by');
        expect(sql.toLowerCase()).toContain('having');
        expect(sql.toLowerCase()).toContain('order by');
        expect(sql.toLowerCase()).toContain('limit');
        expect(sql.toLowerCase()).toContain('offset');
    });

    test('should NOT include auxiliary column fields (created_at, updated_at) in groupBy', async () => {
        const relationship = [
            {
                table: 'aux_form',
                condition: { column: 'aux_form.case_id', refColumn: 'ans.id' },
                type: 'left',
            },
        ];

        const selectFields = ['ans.estado', 'aux_form.created_at as created_at_aux'];

        const groupBy = ['ans.estado'];

        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields, groupBy);

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).toContain('group by');
        expect(sql).toContain('"ans"."estado"');
        expect(sql).not.toContain('#>>');

        expect(sql).not.toContain('aux_form.created_at');
    });
    test('should NOT treat auxiliary column fields as JSON in orderBy', async () => {
        const relationship = [
            {
                table: 'aux_form',
                condition: { column: 'aux_form.case_id', refColumn: 'ans.id' },
                type: 'left',
            },
        ];

        const order = {
            field: 'aux_form.created_at',
            direction: 'asc',
        };

        const criteria = new Criteria(null, relationship, null, null, order, 'ans');

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).not.toContain('#>>');

        expect(sql).toContain('"aux_form"."created_at"');
    });

    test('should still allow auxiliary JSON fields to be grouped correctly', async () => {
        const relationship = [
            {
                table: 'aux_form',
                condition: { column: 'aux_form.case_id', refColumn: 'ans.id' },
                type: 'left',
            },
        ];

        const selectFields = ['ans.estado', 'aux_form.data.campo1 as campo1'];

        const groupBy = ['ans.estado'];

        const criteria = new Criteria(null, relationship, null, null, null, 'ans', selectFields, groupBy);

        const query = criteria.convertToKnex(repository.connection('ans'));
        const sql = query.toSQL().sql.toLowerCase();

        expect(sql).toContain('group by');
    });

    test('should keep prebuilt auxiliary JSON expressions in filters without re-wrapping them', async () => {
        const filters = [
            {
                field: "case_auxiliar.data -> 'flags' ->> 'flag_cumple_para_tiempos_altos_contacto'",
                operator: 'eq',
                value: 'true',
                type: 'and',
            },
        ];

        const relationship = [
            {
                table: 'aux_cases as case_auxiliar',
                condition: { column: 'cases.id', refColumn: 'case_auxiliar.caso_id' },
                type: 'left',
            },
        ];

        const criteria = new Criteria(filters, relationship, null, null, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toSQL().sql;

        expect(sql).toContain("case_auxiliar.data -> 'flags' ->> 'flag_cumple_para_tiempos_altos_contacto' = ?");
        expect(sql).not.toContain("->> 'data -> 'flags'");
    });

    test('should handle IN operator with comma-separated string value on auxiliary entity field', () => {
        const filters = [
            {
                field: 'case_auxiliar.info_parent_case.estado_expediente',
                operator: 'in',
                value: 'Aceptado, En Sitio, Desplazamiento',
                type: 'and',
            },
        ];

        const relationship = [
            {
                table: 'aux_cases as case_auxiliar',
                condition: { column: 'cases.id', refColumn: 'case_auxiliar.caso_id' },
                type: 'join',
            },
        ];

        const criteria = new Criteria(filters, relationship, null, null, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).toContain('in');
        expect(sql).toContain('?');
    });

    test('should handle NOT IN operator with comma-separated string value on auxiliary entity field', () => {
        const filters = [
            {
                field: 'case_auxiliar.info_parent_case.linea',
                operator: 'notIn',
                value: 'AUTOS, CONDUCTOR ELEGIDO',
                type: 'and',
            },
        ];

        const relationship = [
            {
                table: 'aux_cases as case_auxiliar',
                condition: { column: 'cases.id', refColumn: 'case_auxiliar.caso_id' },
                type: 'join',
            },
        ];

        const criteria = new Criteria(filters, relationship, null, null, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).toContain('not in');
        expect(sql).toContain('?');
    });

    test('should handle notNull operator on auxiliary entity field', () => {
        const filters = [
            {
                field: 'case_auxiliar.info_parent_case.numero_expediente',
                operator: 'notNull',
                value: 'null',
                type: 'and',
            },
        ];

        const relationship = [
            {
                table: 'aux_cases as case_auxiliar',
                condition: { column: 'cases.id', refColumn: 'case_auxiliar.caso_id' },
                type: 'join',
            },
        ];

        const criteria = new Criteria(filters, relationship, null, null, null, 'cases');
        const query = criteria.convertToKnex(repository.connection('cases').select('*'));
        const sql = query.toSQL().sql;

        expect(sql.toLowerCase()).toContain('is not null');
    });

    describe('jsonPathEmpty operator', () => {
        test('should generate IS NULL OR empty string condition on a regular field (AND)', () => {
            const filters = [
                {
                    field: 'datos_extra',
                    operator: 'jsonPathEmpty',
                    value: 'null',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'casos');
            const query = criteria.convertToKnex(repository.connection('casos').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });

        test('should generate IS NULL OR empty string condition on a regular field (OR)', () => {
            const filters = [
                {
                    field: 'datos_extra',
                    operator: 'jsonPathEmpty',
                    value: 'null',
                    type: 'OR',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'casos');
            const query = criteria.convertToKnex(repository.connection('casos').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });

        test('should generate jsonPathEmpty condition combined with other AND filters', () => {
            const filters = [
                {
                    field: 'estado',
                    operator: 'eq',
                    value: 'activo',
                    type: 'and',
                },
                {
                    field: 'datos_extra',
                    operator: 'jsonPathEmpty',
                    value: 'null',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'casos');
            const query = criteria.convertToKnex(repository.connection('casos').select('*'));
            const sql = query.toSQL().sql;

            expect(sql.toLowerCase()).toContain('where');
            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });

        test('should generate correct SQL for jsonPathEmpty on regular JSONB column (tabla.columna_jsonb.key)', () => {
            const filters = [
                {
                    field: 'usuarios.data',
                    operator: 'jsonPathEmpty',
                    value: 'id_de_genesys_cloud',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('->>?');
            expect(query.toSQL().bindings).toContain('id_de_genesys_cloud');
            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });

        test('should generate #>> expression for jsonPathEmpty with multi-part sub-path in value', () => {
            const filters = [
                {
                    field: 'usuarios.data',
                    operator: 'jsonPathEmpty',
                    value: 'perfil.id_externo',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('#>>?');
            expect(query.toSQL().bindings).toContain('{perfil,id_externo}');
            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });

        test('should generate correct SQL for jsonPathEmpty with JSONB key in value (OR condition)', () => {
            const filters = [
                {
                    field: 'estado',
                    operator: 'eq',
                    value: 'activo',
                    type: 'and',
                },
                {
                    field: 'usuarios.data',
                    operator: 'jsonPathEmpty',
                    value: 'id_de_genesys_cloud',
                    type: 'OR',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('->>?');
            expect(query.toSQL().bindings).toContain('id_de_genesys_cloud');
            expect(sql).toContain('IS NULL');
            expect(sql).toContain("= ''");
        });
    });

    describe('jsonPathDateBetween operator', () => {
        const from = '2025-12-30T00:00:00.000-05:00';
        const to = '2025-12-30T23:59:59.999-05:00';
        const buildQuery = (value, type = 'and') => {
            const filters = [{ field: 'period', operator: 'jsonPathDateBetween', value, type }];
            const criteria = new Criteria(filters, [], null, null, null, 'report_executions');
            return criteria.convertToKnex(repository.connection('report_executions').select('*')).toSQL();
        };

        test('should compare the JSON path as timestamptz within the range (AND)', () => {
            const { sql, bindings } = buildQuery(JSON.stringify({ path: 'initialDate', from, to }));

            expect(sql).toContain('"report_executions"."period"->>? AS s');
            expect(sql).toMatch(/where \(SELECT CASE[\s\S]+BETWEEN \?::timestamptz AND \?::timestamptz$/);
            expect(bindings).toEqual(['UTC', 'initialDate', from, to]);
        });

        test('should compare the JSON path as timestamptz within the range (OR)', () => {
            const { sql, bindings } = buildQuery(JSON.stringify({ path: 'endDate', from, to }), 'OR');

            expect(sql).toContain('"report_executions"."period"->>? AS s');
            expect(bindings).toEqual(['UTC', 'endDate', from, to]);
        });

        test('should build the same condition when the criteria is converted more than once', () => {
            const filters = [
                {
                    field: 'period',
                    operator: 'jsonPathDateBetween',
                    value: JSON.stringify({ path: 'initialDate', from, to }),
                    type: 'and',
                },
            ];
            const criteria = new Criteria(filters, [], null, null, null, 'report_executions');
            const convert = () =>
                criteria.convertToKnex(repository.connection('report_executions').select('*')).toSQL().bindings;

            convert();

            expect(convert()).toEqual(['UTC', 'initialDate', from, to]);
        });

        test('should reject a value the operator cannot parse', () => {
            expect(() => buildQuery(JSON.stringify({ path: 'initialDate', from: '2025-02-30T00:00:00Z', to }))).toThrow(
                'Invalid JsonPathDateBetween value'
            );
        });
    });

    describe('jsonNotPathEmpty operator', () => {
        test('should generate IS NOT NULL AND not empty string condition on a regular field (AND)', () => {
            const filters = [
                {
                    field: 'datos_extra',
                    operator: 'jsonNotPathEmpty',
                    value: 'null',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'casos');
            const query = criteria.convertToKnex(repository.connection('casos').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('IS NOT NULL');
            expect(sql).toContain("!= ''");
        });

        test('should generate IS NOT NULL AND not empty with JSONB key in value (single key, ->>, AND)', () => {
            const filters = [
                {
                    field: 'usuarios.data',
                    operator: 'jsonNotPathEmpty',
                    value: 'id_de_genesys_cloud',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('->>?');
            expect(query.toSQL().bindings).toContain('id_de_genesys_cloud');
            expect(sql).toContain('IS NOT NULL');
            expect(sql).toContain("!= ''");
        });

        test('should generate #>> expression for jsonNotPathEmpty with multi-part sub-path in value', () => {
            const filters = [
                {
                    field: 'usuarios.data',
                    operator: 'jsonNotPathEmpty',
                    value: 'perfil.id_externo',
                    type: 'and',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('#>>?');
            expect(query.toSQL().bindings).toContain('{perfil,id_externo}');
            expect(sql).toContain('IS NOT NULL');
            expect(sql).toContain("!= ''");
        });

        test('should generate correct SQL for jsonNotPathEmpty with JSONB key in value (OR condition)', () => {
            const filters = [
                {
                    field: 'estado',
                    operator: 'eq',
                    value: 'activo',
                    type: 'and',
                },
                {
                    field: 'usuarios.data',
                    operator: 'jsonNotPathEmpty',
                    value: 'id_de_genesys_cloud',
                    type: 'OR',
                },
            ];

            const criteria = new Criteria(filters, [], null, null, null, 'usuarios');
            const query = criteria.convertToKnex(repository.connection('usuarios').select('*'));
            const sql = query.toSQL().sql;

            expect(sql).toContain('->>?');
            expect(query.toSQL().bindings).toContain('id_de_genesys_cloud');
            expect(sql).toContain('IS NOT NULL');
            expect(sql).toContain("!= ''");
        });
    });
});
