import Knex from 'knex';
import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Criteria — cobertura de filtros, SELECT y estructura (segunda pasada)', () => {
    let repository;

    beforeAll(() => {
        repository = new KnexRepository(knexConfig);
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    const auxRelationship = [
        {
            table: 'aux_proveedores as case_auxiliar',
            condition: { column: 'case_auxiliar.id', refColumn: 'ans.id' },
            type: 'left',
        },
    ];

    const build = (filters, tablename = 'ans', relationship = [], select = null, group_by = null) => {
        const criteria = new Criteria(filters, relationship, 10, 0, null, tablename, select, group_by);
        const query = repository.connection(tablename);

        return criteria.convertToKnex(query).toSQL();
    };

    describe('#getBoardsWhereConditions — operadores sobre campo auxiliar (JSON)', () => {
        it.each([
            ['eq', 'x', "case_auxiliar.data ->> 'campo' = ?"],
            ['like', 'abc', "case_auxiliar.data ->> 'campo' LIKE ?"],
            ['null', 'x', "case_auxiliar.data ->> 'campo' IS NULL"],
        ])('operador %s genera la clausula SQL esperada', (operator, value, expectedFragment) => {
            const { sql } = build(
                [{ field: 'case_auxiliar.campo', operator, type: 'AND', value }],
                'ans',
                auxRelationship
            );

            expect(sql).toContain(expectedFragment);
        });

        it('operador in convierte el valor separado por comas en un IN parametrizado', () => {
            const { sql, bindings } = build(
                [{ field: 'case_auxiliar.campo', operator: 'in', type: 'AND', value: '1,2,3' }],
                'ans',
                auxRelationship
            );

            expect(sql).toContain("case_auxiliar.data ->> 'campo' IN (?, ?, ?)");
            expect(bindings).toEqual(expect.arrayContaining(['1', '2', '3']));
        });

        it('el operador jsonArrayValue sobre un campo auxiliar no genera ninguna clausula WHERE (isJsonOp corta antes)', () => {
            const { sql } = build(
                [{ field: 'case_auxiliar.campo', operator: 'jsonArrayValue', type: 'AND', value: '1,2' }],
                'ans',
                auxRelationship
            );

            expect(sql).not.toContain('where');
        });

        it('un campo con un operador aritmetico (isSqlExpression) se agrega tal cual con AND', () => {
            const { sql } = build(
                [
                    { field: 'ans.status', operator: 'eq', type: 'AND', value: '1' },
                    { field: 'case_auxiliar.campo1 - campo2', operator: 'eq', type: 'AND', value: 'x' },
                ],
                'ans',
                auxRelationship
            );

            expect(sql).toContain('and case_auxiliar.campo1 - campo2');
            expect(sql).not.toContain('case_auxiliar.data ->>');
        });

        it('un campo con isSqlExpression y type OR se agrega con OR en vez de AND', () => {
            const { sql } = build(
                [
                    { field: 'ans.status', operator: 'eq', type: 'AND', value: '1' },
                    { field: 'case_auxiliar.campo1 - campo2', operator: 'eq', type: 'OR', value: 'x' },
                ],
                'ans',
                auxRelationship
            );

            expect(sql).toContain('or case_auxiliar.campo1 - campo2');
            expect(sql).not.toContain('and case_auxiliar.campo1 - campo2');
        });

        it('un filtro auxiliar JSON con type OR usa OR en vez de AND tras un filtro previo', () => {
            const { sql } = build(
                [
                    { field: 'ans.status', operator: 'eq', type: 'AND', value: '1' },
                    { field: 'case_auxiliar.campo', operator: 'eq', type: 'OR', value: 'x' },
                ],
                'ans',
                auxRelationship
            );

            expect(sql).toContain("or case_auxiliar.data ->> 'campo' = ?");
        });

        it('between con un valor que no es ni array ni string deja los limites sin definir (rama Array.isArray falsa)', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.campo', operator: 'between', type: 'AND', value: 12345 }],
                    'ans',
                    auxRelationship
                )
            ).toThrow(/Undefined binding/);
        });
    });

    describe('validaciones de operador previas a construir la clausula', () => {
        it('validateJsonContains acepta un objeto plano y lo compara con @>', () => {
            const { sql } = build(
                [{ field: 'case_auxiliar.data', operator: 'jsonContains', type: 'AND', value: { a: 1 } }],
                'ans',
                auxRelationship
            );

            expect(sql).toContain('@>');
        });

        it('validateJsonContains rechaza un string que no es JSON valido', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.data', operator: 'jsonContains', type: 'AND', value: 'not-json' }],
                    'ans',
                    auxRelationship
                )
            ).toThrow('Invalid JsonContains value');
        });

        it('validateJsonContains rechaza un array serializado (debe ser objeto)', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.data', operator: 'jsonContains', type: 'AND', value: '[1,2]' }],
                    'ans',
                    auxRelationship
                )
            ).toThrow('Invalid JsonContains value');
        });

        it('validateJsonContains rechaza un valor que no es objeto ni string', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.data', operator: 'jsonContains', type: 'AND', value: 5 }],
                    'ans',
                    auxRelationship
                )
            ).toThrow('JsonContains value must be a JSON string');
        });

        it('validateBetweenOperator con un array de 3 valores lanza error', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.campo', operator: 'between', type: 'AND', value: ['1', '2', '3'] }],
                    'ans',
                    auxRelationship
                )
            ).toThrow('Invalid between condition, must be two values');
        });

        it('validateBetweenOperator con un string de 3 valores separados por coma lanza error', () => {
            expect(() =>
                build(
                    [{ field: 'case_auxiliar.campo', operator: 'between', type: 'AND', value: '1,2,3' }],
                    'ans',
                    auxRelationship
                )
            ).toThrow('Invalid between condition, must be two values');
        });

        it('validateBetweenOperator con un array de numeros no falla al intentar recortar strings', () => {
            const { sql } = build(
                [{ field: 'case_auxiliar.campo', operator: 'between', type: 'AND', value: [1, 2] }],
                'ans',
                auxRelationship
            );

            expect(sql).toContain('BETWEEN ? AND ?');
        });
    });

    describe('#applyLoggedInUserFilter — campo auxiliar', () => {
        it('un campo auxiliar en logged_in_user se resuelve como expresion JSON, no como columna directa', () => {
            const { sql, bindings } = build(
                [
                    {
                        field: 'case_auxiliar.responsable_id',
                        operator: 'eq',
                        type: 'AND',
                        value: { function: 'logged_in_user', value: 'u1' },
                    },
                ],
                'ans',
                auxRelationship
            );

            expect(sql).toContain("case_auxiliar.data ->> 'responsable_id' = ?");
            expect(bindings).toContain('u1');
        });
    });

    describe('#applyRecentDateFilter', () => {
        it('usa una ventana por defecto de 2 minutos cuando no se especifica value', () => {
            const { sql, bindings } = build([
                { field: 'ans.created_at', operator: 'gt', type: 'AND', value: { function: 'recent_date' } },
            ]);

            expect(sql).toContain(">= NOW() - INTERVAL '1 minute' * ?");
            expect(bindings).toContain(2);
        });

        it('usa la ventana explicita indicada en value', () => {
            const { bindings } = build([
                {
                    field: 'ans.created_at',
                    operator: 'gt',
                    type: 'AND',
                    value: { function: 'recent_date', value: '15' },
                },
            ]);

            expect(bindings).toContain(15);
            expect(bindings).not.toContain(2);
        });

        it('con operador neq genera la variante "inactivo" (menor a la ventana O nulo) en vez de la variante activa', () => {
            const { sql } = build([
                {
                    field: 'ans.created_at',
                    operator: 'neq',
                    type: 'AND',
                    value: { function: 'recent_date', value: '15' },
                },
            ]);

            expect(sql).toContain('< NOW()');
            expect(sql).toContain('IS NULL');
            expect(sql).not.toContain('>= NOW()');
        });

        it('con type OR usa orWhereRaw en vez de whereRaw tras un filtro previo', () => {
            const { sql } = build([
                { field: 'ans.status', operator: 'eq', type: 'AND', value: '1' },
                { field: 'ans.created_at', operator: 'gt', type: 'OR', value: { function: 'recent_date', value: '5' } },
            ]);

            expect(sql).toContain('or');
        });

        it('una ventana no positiva lanza error', () => {
            expect(() =>
                build([
                    {
                        field: 'ans.created_at',
                        operator: 'gt',
                        type: 'AND',
                        value: { function: 'recent_date', value: '-5' },
                    },
                ])
            ).toThrow('recent_date filter requires a positive time window in minutes');
        });

        it('una ventana no numerica lanza error', () => {
            expect(() =>
                build([
                    {
                        field: 'ans.created_at',
                        operator: 'gt',
                        type: 'AND',
                        value: { function: 'recent_date', value: 'abc' },
                    },
                ])
            ).toThrow('recent_date filter requires a positive time window in minutes');
        });
    });

    describe('#applyDateCalculatedFilter', () => {
        it.each([
            ['eq', '=', 'date_calculated_add', '+'],
            ['neq', '!=', 'date_calculated_add', '+'],
            ['lt', '<', 'date_calculated_substract', '-'],
            ['lte', '<=', 'date_calculated_substract', '-'],
        ])(
            'operador %s con %s genera comparacion directa contra NOW() %s INTERVAL',
            (operator, sqlOperator, fnName, intervalOp) => {
                const { sql } = build([
                    { field: 'ans.created_at', operator, type: 'AND', value: { function: fnName, value: '5' } },
                ]);

                expect(sql).toContain(`ans.created_at ${sqlOperator} NOW() ${intervalOp} INTERVAL '5 days'`);
            }
        );

        it('date_calculated_substract con between ordena los dias de mayor a menor (older, newer)', () => {
            const { sql } = build([
                {
                    field: 'ans.created_at',
                    operator: 'between',
                    type: 'AND',
                    value: { function: 'date_calculated_substract', value: '2, 10' },
                },
            ]);

            expect(sql).toContain("BETWEEN NOW() - INTERVAL '10 days' AND NOW() - INTERVAL '2 days'");
        });

        it('date_calculated_add con between ordena los dias de menor a mayor (smaller, larger)', () => {
            const { sql } = build([
                {
                    field: 'ans.created_at',
                    operator: 'between',
                    type: 'AND',
                    value: { function: 'date_calculated_add', value: '10, 2' },
                },
            ]);

            expect(sql).toContain("BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '10 days'");
        });

        it('date_calculated between con un valor no numerico lanza error', () => {
            expect(() =>
                build([
                    {
                        field: 'ans.created_at',
                        operator: 'between',
                        type: 'AND',
                        value: { function: 'date_calculated_add', value: '2, abc' },
                    },
                ])
            ).toThrow('date_calculated_add between requires two numeric values');
        });

        it('date_calculated between con menos de dos valores lanza error', () => {
            expect(() =>
                build([
                    {
                        field: 'ans.created_at',
                        operator: 'between',
                        type: 'AND',
                        value: { function: 'date_calculated_add', value: '2' },
                    },
                ])
            ).toThrow('date_calculated_add between requires two numeric values');
        });

        it('un operador no soportado (in) lanza error con el nombre de la funcion', () => {
            expect(() =>
                build([
                    {
                        field: 'ans.created_at',
                        operator: 'in',
                        type: 'AND',
                        value: { function: 'date_calculated_add', value: '5' },
                    },
                ])
            ).toThrow('Unsupported operator for date_calculated_add: in');
        });
    });

    describe('filtros SQL crudos (isBoardUnifiedSqlWhere) al nivel superior', () => {
        it('uno posterior con type OR usa orWhereRaw', () => {
            const { sql } = build([
                { field: 'ans.estado', operator: 'eq', type: 'AND', value: 'Y' },
                { isBoardUnifiedSqlWhere: true, sql: "ans.estado = 'X'", type: 'OR' },
            ]);

            expect(sql).toContain("or ans.estado = 'X'");
        });

        it('uno posterior con type AND (u otro valor) usa andWhereRaw', () => {
            const { sql } = build([
                { field: 'ans.estado', operator: 'eq', type: 'AND', value: 'Y' },
                { isBoardUnifiedSqlWhere: true, sql: "ans.estado = 'X'", type: 'AND' },
            ]);

            expect(sql).toContain("and ans.estado = 'X'");
            expect(sql).not.toContain("or ans.estado = 'X'");
        });
    });

    describe('filtros agrupados (groupType)', () => {
        it('un grupo OR como primer filtro usa where(...) para abrir el grupo', () => {
            const { sql } = build([
                {
                    groupType: 'OR',
                    filters: [
                        { field: 'ans.estado', operator: 'eq', type: 'AND', value: 'A' },
                        { field: 'ans.estado', operator: 'eq', type: 'OR', value: 'B' },
                    ],
                },
            ]);

            expect(sql).toContain('where ("ans"."estado" = ? or "ans"."estado" = ?)');
        });

        it('un grupo AND que no es el primer filtro se une con andWhere', () => {
            const { sql } = build([
                { field: 'ans.status', operator: 'eq', type: 'AND', value: '1' },
                { groupType: 'AND', filters: [{ field: 'ans.estado', operator: 'eq', type: 'AND', value: 'A' }] },
            ]);

            expect(sql).toContain('and ("ans"."estado" = ?)');
        });

        it('el guard deleted_at cubre a todos los OR de nombre dentro de un grupo AND (busqueda de usuarios)', () => {
            const { sql } = build(
                [
                    { field: 'deleted_at', operator: 'null', type: 'AND', value: 'null' },
                    {
                        groupType: 'AND',
                        filters: [
                            { field: 'nombres', operator: 'ilike', type: 'OR', value: 'Juan' },
                            { field: 'apellido1', operator: 'ilike', type: 'OR', value: 'Juan' },
                            { field: 'apellido2', operator: 'ilike', type: 'OR', value: 'Juan' },
                        ],
                    },
                ],
                'usuarios'
            );

            expect(sql).toMatch(/deleted_at.*is null.*\(.*ilike.*or.*ilike/s);
        });

        it('dentro de un grupo, un subfiltro crudo posterior con OR usa orWhereRaw', () => {
            const { sql } = build([
                {
                    groupType: 'OR',
                    filters: [
                        { isBoardUnifiedSqlWhere: true, sql: 'ans.a = 1', type: 'AND' },
                        { isBoardUnifiedSqlWhere: true, sql: 'ans.b = 2', type: 'OR' },
                    ],
                },
            ]);

            expect(sql).toContain('(ans.a = 1 or ans.b = 2)');
        });

        it('dentro de un grupo, un subfiltro crudo posterior con AND usa andWhereRaw', () => {
            const { sql } = build([
                {
                    groupType: 'OR',
                    filters: [
                        { isBoardUnifiedSqlWhere: true, sql: 'ans.a = 1', type: 'AND' },
                        { isBoardUnifiedSqlWhere: true, sql: 'ans.c = 3', type: 'AND' },
                    ],
                },
            ]);

            expect(sql).toContain('(ans.a = 1 and ans.c = 3)');
        });

        it('dentro de un grupo, un subfiltro sobre campo auxiliar usa la ruta JSON', () => {
            const { sql } = build(
                [
                    {
                        groupType: 'OR',
                        filters: [{ field: 'case_auxiliar.campo', operator: 'eq', type: 'AND', value: 'x' }],
                    },
                ],
                'ans',
                auxRelationship
            );

            expect(sql).toContain("case_auxiliar.data ->> 'campo' = ?");
        });

        it('dentro de un grupo, un subfiltro sobre campo no auxiliar usa la ruta de columna normal', () => {
            const { sql } = build([
                { groupType: 'OR', filters: [{ field: 'ans.estado', operator: 'eq', type: 'AND', value: 'x' }] },
            ]);

            expect(sql).toContain('"ans"."estado" = ?');
            expect(sql).not.toContain('->>');
        });
    });

    describe('SELECT con funciones (agregados, DATE_DIFFERENCE, CONCAT, campos auxiliares)', () => {
        it('una funcion agregada sobre un campo auxiliar genera SUM/AVG/etc sobre la expresion JSON, no sobre la columna', () => {
            const { sql } = build([], 'ans', auxRelationship, [
                { field: 'case_auxiliar.monto', function: 'sum', alias: 'total' },
            ]);

            expect(sql).toContain('sum(case_auxiliar.data #>> \'{monto}\') as "total"');
        });

        it('una funcion agregada sobre un campo no auxiliar usa knex.sum/avg/min/max/count directamente sobre la columna', () => {
            const { sql } = build([], 'ans', [], [{ field: 'ans.monto', function: 'sum', alias: 'total' }]);

            expect(sql).toContain('sum("ans"."monto") as "total"');
            expect(sql).not.toContain('#>>');
        });

        it('DATE_DIFFERENCE genera un EXTRACT(EPOCH FROM ...) con los dos campos separados por ":::"', () => {
            const { sql } = build(
                [],
                'ans',
                [],
                [{ field: 'ans.updated_at::: ans.created_at', function: 'date_difference', alias: 'diff' }]
            );

            expect(sql).toContain('EXTRACT(EPOCH FROM (ans.created_at - ans.updated_at)) as "diff"');
        });

        it('CONCAT genera un CONCAT(...) con el campo tal cual', () => {
            const { sql } = build([], 'ans', [], [{ field: "ans.a, ' ', ans.b", function: 'concat', alias: 'full' }]);

            expect(sql).toContain('CONCAT(ans.a, \' \', ans.b) as "full"');
        });

        it('un select string sobre campo auxiliar con ruta anidada de dos niveles usa STRING_AGG para arrays', () => {
            const { sql } = build([], 'ans', auxRelationship, ['case_auxiliar.form1.campo as valor']);

            expect(sql).toContain('STRING_AGG');
            expect(sql).toContain("jsonb_typeof(case_auxiliar.data #> '{form1}')");
        });

        it('un select string sobre campo auxiliar de un solo nivel NO usa STRING_AGG (rama pathParts.length<=1)', () => {
            const { sql } = build([], 'ans', auxRelationship, ['case_auxiliar.campo as valor']);

            expect(sql).not.toContain('STRING_AGG');
            expect(sql).toContain('case_auxiliar.data #>> \'{campo}\' as "valor"');
        });
    });

    describe('estructura general: relaciones, tablename, tablas permitidas', () => {
        it('una relacion de tipo right genera un RIGHT JOIN', () => {
            const { sql } = build([], 'ans', [
                {
                    table: 'aux_proveedores as case_auxiliar',
                    condition: { column: 'case_auxiliar.id', refColumn: 'ans.id' },
                    type: 'right',
                },
            ]);

            expect(sql).toContain('right join');
            expect(sql).not.toContain('left join');
        });

        it('sin tablename, la propiedad tablename queda en null (rama ?? del constructor)', () => {
            const criteria = new Criteria([], [], null, null, null, undefined);

            expect(criteria.tablename).toBeNull();
        });

        it('sin config de schema en la conexion knex, la tabla relacionada no se prefija', () => {
            const noSchemaKnex = Knex({ client: 'pg' });
            const criteria = new Criteria([], auxRelationship, 10, 0, null, 'ans');
            const sql = criteria.convertToKnex(noSchemaKnex('ans')).toSQL().sql;

            expect(sql).toContain('left join "aux_proveedores"');
            expect(sql).not.toContain('"public"."aux_proveedores"');

            return noSchemaKnex.destroy();
        });

        it('un filtro simple de nivel superior con type OR se agrega igual (primer filtro no muestra el OR en el SQL)', () => {
            const { sql, bindings } = build([{ field: 'ans.status', operator: 'eq', type: 'OR', value: '1' }]);

            expect(sql).toContain('"ans"."status" = ?');
            expect(bindings).toContain('1');
        });
    });
});
