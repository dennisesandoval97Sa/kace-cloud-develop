import { Criteria, KnexRepository } from '../../../src/shared/index.js';
import { knexConfig } from '../../knexfile.js';

describe('Criteria — ordenacion por tipo de dato', () => {
    let repository;

    beforeAll(() => {
        repository = new KnexRepository(knexConfig);
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    const buildSql = (order) => {
        const criteria = new Criteria([], [], 100, 0, order, 'usuarios');
        const query = repository.connection('usuarios');

        return criteria.convertToKnex(query).toSQL().sql;
    };

    describe('columna simple', () => {
        it.each([
            ['NUMBER', 'NUMERIC'],
            ['INTEGER', 'NUMERIC'],
            ['INT', 'NUMERIC'],
            ['DATE', 'TIMESTAMPTZ'],
            ['DATETIME', 'TIMESTAMPTZ'],
            ['TIMESTAMP', 'TIMESTAMPTZ'],
            ['BOOLEAN', 'BOOLEAN'],
            ['BOOL', 'BOOLEAN'],
        ])('ordena una columna de tipo %s con un CAST a %s', (data_type, expectedCast) => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type });

            expect(sql).toContain(expectedCast);
            expect(sql).toContain('NULLS LAST');
        });

        it.each([
            ['NUMBER', 'TIMESTAMPTZ'],
            ['DATE', 'NUMERIC'],
            ['BOOLEAN', 'NUMERIC'],
        ])('el CAST de tipo %s no es el de otro tipo distinto (%s)', (data_type, foreignCast) => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type });

            expect(sql).not.toContain(foreignCast);
        });

        it.each([['ARRAY'], ['JSON'], ['OBJECT']])(
            'ordena una columna de tipo %s con COALESCE a texto',
            (data_type) => {
                const sql = buildSql({ field: 'nombre', direction: 'asc', data_type });

                expect(sql).toContain('COALESCE');
                expect(sql).not.toContain('CAST');
            }
        );

        it('aplica LOWER cuando la ordenacion es insensible a mayusculas', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'STRING', insensitive: true });

            expect(sql).toContain('LOWER');
        });

        it('no aplica LOWER cuando la ordenacion es sensible a mayusculas', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'STRING' });

            expect(sql).not.toContain('LOWER');
        });

        it('aplica LOWER cuando es insensible incluso sin tipo de dato reconocido (rama else)', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'UNKNOWN_TYPE', insensitive: true });

            expect(sql).toContain('LOWER');
        });

        it('no aplica LOWER con tipo de dato no reconocido y sensible a mayusculas (rama else)', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'UNKNOWN_TYPE' });

            expect(sql).not.toContain('LOWER');
        });

        it('acepta el tipo de dato en minusculas', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'number' });

            expect(sql).toContain('NUMERIC');
        });

        it('ordena sin CAST cuando no se indica tipo de dato', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc' });

            expect(sql).not.toContain('CAST');
            expect(sql).not.toContain('NULLS LAST');
        });

        it('ordena descendente', () => {
            const sql = buildSql({ field: 'nombre', direction: 'desc', data_type: 'NUMBER' });

            expect(sql.toLowerCase()).toContain('desc');
            expect(sql.toLowerCase()).not.toContain('asc');
        });

        it('ordena ascendente', () => {
            const sql = buildSql({ field: 'nombre', direction: 'asc', data_type: 'NUMBER' });

            expect(sql.toLowerCase()).toContain('asc');
        });
    });

    describe('columna auxiliar (expresion JSON)', () => {
        const buildAuxSql = (order) => {
            const criteria = new Criteria([], [], 100, 0, order, 'ans');
            const query = repository.connection('ans');

            return criteria.convertToKnex(query).toSQL().sql;
        };

        it.each([
            ['NUMBER', 'NUMERIC'],
            ['DATE', 'TIMESTAMPTZ'],
            ['BOOLEAN', 'BOOLEAN'],
        ])('ordena una expresion JSON aux_ de tipo %s con un CAST a %s', (data_type, expectedCast) => {
            const sql = buildAuxSql({ field: 'aux_cases.form1.campo', direction: 'asc', data_type });

            expect(sql).toContain(expectedCast);
        });

        it.each([['ARRAY'], ['JSON'], ['OBJECT']])(
            'ordena una expresion JSON aux_ de tipo %s con COALESCE a texto',
            (data_type) => {
                const sql = buildAuxSql({ field: 'aux_cases.form1.campo', direction: 'asc', data_type });

                expect(sql).toContain('COALESCE');
                expect(sql).not.toContain('CAST');
            }
        );

        it('aplica LOWER en una expresion JSON aux_ de tipo STRING insensible a mayusculas', () => {
            const sql = buildAuxSql({
                field: 'aux_cases.form1.campo',
                direction: 'asc',
                data_type: 'STRING',
                insensitive: true,
            });

            expect(sql).toContain('LOWER');
        });

        it('no aplica LOWER en una expresion JSON aux_ de tipo STRING sensible a mayusculas', () => {
            const sql = buildAuxSql({ field: 'aux_cases.form1.campo', direction: 'asc', data_type: 'STRING' });

            expect(sql).not.toContain('LOWER');
        });

        it('DATE en una expresion JSON aux_ contempla valores nulos y N/A antes del CAST', () => {
            const sql = buildAuxSql({ field: 'aux_cases.form1.campo', direction: 'asc', data_type: 'DATE' });

            expect(sql).toContain('IS NULL OR');
            expect(sql).toContain("'N/A'");
        });
    });

    describe('normalizacion de limites de fecha en filtros auxiliares', () => {
        const relationship = [
            {
                table: 'aux_proveedores as case_auxiliar',
                condition: {
                    column: 'case_auxiliar.id',
                    refColumn: 'ans.id',
                },
                type: 'left',
            },
        ];

        const buildFilterBindings = (value, operator = 'gt') => {
            const filters = [
                {
                    field: 'case_auxiliar.fecha_cita',
                    operator,
                    type: 'AND',
                    value,
                },
            ];
            const criteria = new Criteria(filters, relationship, 10, 0, null, 'ans');
            const query = repository.connection('ans');

            return criteria.convertToKnex(query).toSQL().bindings;
        };

        it.each([
            ['ISO simple (YYYY-MM-DD)', '2026-04-15'],
            ['ISO con hora y Z', '2026-04-15T10:00:00Z'],
        ])(
            'deja intacto un limite de fecha ya en formato %s (ninguna rama de normalizacion aplica)',
            (label, rawValue) => {
                const bindings = buildFilterBindings(rawValue);

                expect(bindings).toContain(rawValue);
            }
        );

        it.each([
            ['compacto YYYYMMDD', '20260415', '2026-04-15T00:00:00.000Z'],
            ['epoch en segundos (10 digitos)', '1776211200', '2026-04-15T00:00:00.000Z'],
            ['epoch en milisegundos (13 digitos)', '1776211200000', '2026-04-15T00:00:00.000Z'],
            ['con barras, dia > 12 (dd/mm/yyyy)', '25/04/2026', '2026-04-25T00:00:00.000Z'],
            ['con barras, ambos <= 12 (se interpreta dia=primer numero)', '04/05/2026', '2026-05-04T00:00:00.000Z'],
        ])('normaliza el limite de fecha con formato %s a un instante UTC', (label, rawValue, expectedIso) => {
            const bindings = buildFilterBindings(rawValue);

            expect(bindings).toContain(expectedIso);
            expect(bindings).not.toContain(rawValue);
        });

        it.each([
            ['mes en ingles, mes primero', 'April 15, 2026'],
            ['mes en ingles, dia primero', '15 April 2026'],
        ])('normaliza el limite de fecha con formato %s usando el parseo nativo de Date', (label, rawValue) => {
            const bindings = buildFilterBindings(rawValue);
            const expectedIso = new Date(rawValue).toISOString();

            expect(bindings).toContain(expectedIso);
            expect(bindings).not.toContain(rawValue);
        });

        it('normaliza ambos extremos de un filtro between con formatos distintos', () => {
            const bindings = buildFilterBindings(['20260101', '31/12/2026'], 'between');

            expect(bindings).toContain('2026-01-01T00:00:00.000Z');
            expect(bindings).toContain('2026-12-31T00:00:00.000Z');
        });

        it('un valor que no parece fecha viaja intacto como binding en lugar de normalizarse', () => {
            const bindings = buildFilterBindings('texto-no-fecha');

            expect(bindings).toContain('texto-no-fecha');
        });
    });

    describe('deteccion de campo auxiliar al ordenar (#processOrder)', () => {
        const buildOrderSql = (order, tablename = 'ans', group_by = null) => {
            const criteria = new Criteria([], [], 100, 0, order, tablename, null, group_by);
            const query = repository.connection(tablename);

            return criteria.convertToKnex(query).toSQL().sql;
        };

        it('un campo con prefijo aux- (guion) tambien se trata como JSON auxiliar', () => {
            const sql = buildOrderSql({ field: 'aux-cases.form1.campo', direction: 'asc', data_type: 'NUMBER' });

            expect(sql).toContain("aux-cases.data #>> '{form1,campo}'");
        });

        it('un campo que contiene case_auxiliar sin prefijo aux_ tambien se trata como JSON auxiliar', () => {
            const sql = buildOrderSql({ field: 'case_auxiliar.campo', direction: 'asc', data_type: 'NUMBER' });

            expect(sql).toContain("case_auxiliar.data #>> '{campo}'");
        });

        it('un campo que contiene clients_auxiliar sin prefijo aux_ tambien se trata como JSON auxiliar', () => {
            const sql = buildOrderSql({ field: 'clients_auxiliar.campo', direction: 'asc', data_type: 'NUMBER' });

            expect(sql).toContain("clients_auxiliar.data #>> '{campo}'");
        });

        it('aux_definitions queda excluido del tratamiento JSON pese al prefijo aux_', () => {
            const sql = buildOrderSql({ field: 'aux_definitions.campo', direction: 'asc', data_type: 'NUMBER' });

            expect(sql).toContain('"aux_definitions"."campo"');
            expect(sql).not.toContain('#>>');
        });

        it('una columna auxiliar excluida (id) se ordena como columna simple, no como ruta JSON', () => {
            const sql = buildOrderSql({ field: 'aux_cases.id', direction: 'asc' });

            expect(sql).toContain('"aux_cases"."id"');
            expect(sql).not.toContain('#>>');
        });

        it('una columna fisica especializada (caso_id de aux_cases) se ordena como columna simple', () => {
            const sql = buildOrderSql({ field: 'aux_cases.caso_id', direction: 'asc' });

            expect(sql).toContain('"aux_cases"."caso_id"');
            expect(sql).not.toContain('#>>');
        });

        it('una columna de dos partes que no esta en la lista de exclusion si se trata como ruta JSON', () => {
            const sql = buildOrderSql({ field: 'aux_cases.otracampo', direction: 'asc' });

            expect(sql).toContain("aux_cases.data #>> '{otracampo}'");
        });

        it('agrega la expresion JSON del order a GROUP BY cuando la consulta ya agrupa', () => {
            const sql = buildOrderSql({ field: 'aux_cases.form1.campo', direction: 'asc' }, 'ans', ['ans.id']);

            expect(sql).toContain('group by');
            expect(sql).toContain("aux_cases.data #>> '{form1,campo}'");
        });

        it('agrega el campo simple del order a GROUP BY cuando la consulta ya agrupa', () => {
            const sql = buildOrderSql({ field: 'usuarios.nombre', direction: 'asc' }, 'usuarios', ['usuarios.id']);

            expect(sql).toContain('group by');
            expect(sql).toContain('"usuarios"."nombre"');
        });
    });
});
