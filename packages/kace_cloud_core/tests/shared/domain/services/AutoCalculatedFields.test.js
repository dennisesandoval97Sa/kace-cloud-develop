import { jest } from '@jest/globals';
import AutoCalculatedFields from '../../../../src/shared/domain/services/AutoCalculatedFields.js';
import { ValidationFailError } from '../../../../src/shared/errors/ValidationFailError.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

function buildAuxCase(formId, fields) {
    return {
        data: { value: { [formId]: { ...fields } } },
        fields: null,
    };
}

function buildSchema(formId, fieldConfigs) {
    return {
        value: {
            [formId]: {
                type: 'object',
                required: false,
                data_structure: fieldConfigs,
            },
        },
    };
}

function calcField(formula, opts = {}) {
    return {
        type: 'calculated',
        required: false,
        calc: {
            formula,
            error_policy: opts.error_policy || 'error',
            on: opts.on || ['create', 'update'],
        },
    };
}

function dateField(timezone) {
    return {
        type: 'date',
        required: false,
        ...(timezone ? { timezone } : {}),
    };
}

describe('AutoCalculatedFields', () => {
    let logErrorSpy;

    beforeEach(() => {
        logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
    });

    afterEach(() => {
        logErrorSpy.mockRestore();
    });

    describe('execute() - early returns', () => {
        it('should return {} when auxCase.data is undefined', () => {
            const auxCase = { data: undefined, fields: null };
            const schema = { value: {} };

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result).toEqual({});
        });

        it('should return {} when auxCase.data.value is empty', () => {
            const auxCase = { data: { value: {} }, fields: null };
            const schema = { value: {} };

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result).toEqual({});
        });

        it('should skip forms with no matching schema when data_structure exists', () => {
            const auxCase = buildAuxCase('form1', { a: 10 });
            const schema = { value: { data_structure: { other: { type: 'text', required: false } } } };

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result).toEqual({});
        });

        it('should skip forms when schema has no data_structure', () => {
            const auxCase = buildAuxCase('form1', { a: 10 });
            const schema = { value: { form1: { type: 'object', required: false } } };

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result).toEqual({});
        });
    });

    describe('execute() - context type filtering', () => {
        it('should calculate when contextType matches on array', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 3 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), ref(b))', { on: ['create'] }),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result.f1.result).toBe(8);
        });

        it('should skip field when contextType does NOT match on array', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 3 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), ref(b))', { on: ['create'] }),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('update');

            expect(result.f1.result).toBeUndefined();
        });

        it('should default on to [create, update] when not specified', () => {
            const auxCase = buildAuxCase('f1', { a: 2, b: 3 });
            const fieldConfig = {
                type: 'calculated',
                required: false,
                calc: { formula: 'sum(ref(a), ref(b))' },
            };
            const schema = buildSchema('f1', { result: fieldConfig });

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(svc.execute('create').f1.result).toBe(5);
            auxCase.data.value.f1 = { a: 2, b: 3 };
            expect(svc.execute('update').f1.result).toBe(5);
        });

        it('should return null for skipped fields when error_policy is empty', () => {
            const auxCase = buildAuxCase('f1', { a: 5 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), 1)', { on: ['create'], error_policy: 'empty' }),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('update');

            expect(result.f1.result).toBeNull();
        });
    });

    describe('execute() - math functions', () => {
        it('should evaluate sum(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 20 });
            const schema = buildSchema('f1', { result: calcField('sum(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(30);
        });

        it('should evaluate sub(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 50, b: 15 });
            const schema = buildSchema('f1', { result: calcField('sub(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(35);
        });

        it('should evaluate mul(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 4, b: 7 });
            const schema = buildSchema('f1', { result: calcField('mul(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(28);
        });

        it('should evaluate div(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 100, b: 4 });
            const schema = buildSchema('f1', { result: calcField('div(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(25);
        });

        it('should evaluate round(ref(a), 2)', () => {
            const auxCase = buildAuxCase('f1', { a: 3.14159 });
            const schema = buildSchema('f1', { result: calcField('round(ref(a), 2)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(3.14);
        });

        it('should evaluate min and max', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 3, c: 7 });
            const schema = buildSchema('f1', {
                lowest: calcField('min(ref(a), ref(b), ref(c))'),
                highest: calcField('max(ref(a), ref(b), ref(c))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.lowest).toBe(3);
            expect(result.f1.highest).toBe(10);
        });

        it('should handle nested math: sum(mul(ref(a), ref(b)), ref(c))', () => {
            const auxCase = buildAuxCase('f1', { a: 3, b: 4, c: 5 });
            const schema = buildSchema('f1', {
                result: calcField('sum(mul(ref(a), ref(b)), ref(c))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(17);
        });
    });

    describe('execute() - date functions', () => {
        const baseDate = '2025-10-17T00:00:00Z';

        it('should evaluate addDays(ref(date), 5)', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('addDays(ref(date), 5)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-10-22T00:00:00.000Z');
        });

        it('should evaluate subDays(ref(date), 3)', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('subDays(ref(date), 3)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-10-14T00:00:00.000Z');
        });

        it('should evaluate addMonths(ref(date), 2)', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('addMonths(ref(date), 2)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-12-17T00:00:00.000Z');
        });

        it('should evaluate diffDays(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', {
                a: '2025-10-20T00:00:00Z',
                b: '2025-10-17T00:00:00Z',
            });
            const schema = buildSchema('f1', { result: calcField('diffDays(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(3);
        });

        it('should evaluate startOfMonth(ref(date))', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('startOfMonth(ref(date))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-10-01T00:00:00.000Z');
        });

        it('should evaluate endOfMonth(ref(date))', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('endOfMonth(ref(date))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-10-31T23:59:59.999Z');
        });

        it('should evaluate addHours(ref(date), 5)', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', { result: calcField('addHours(ref(date), 5)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('2025-10-17T05:00:00.000Z');
        });

        it('should evaluate nested: diffDays(addDays(ref(date), 10), ref(date))', () => {
            const auxCase = buildAuxCase('f1', { date: baseDate });
            const schema = buildSchema('f1', {
                result: calcField('diffDays(addDays(ref(date), 10), ref(date))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(10);
        });

        it('should return null when date field is null', () => {
            const auxCase = buildAuxCase('f1', { date: null });
            const schema = buildSchema('f1', { result: calcField('addDays(ref(date), 5)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBeNull();
        });

        describe('with Colombia timezone offset (UTC-5)', () => {
            // '2026-02-14T08:00:00-05:00' equivale a '2026-02-14T13:00:00Z' en UTC.
            // Las funciones detectan el offset embebido y normalizan a UTC antes de operar.
            // El resultado siempre se devuelve en UTC (formato .toISOString()).
            const colombiaDate = '2026-02-14T08:00:00-05:00';

            it('should addDays on a date with Colombia offset and return UTC', () => {
                const auxCase = buildAuxCase('f1', { date: colombiaDate });
                const schema = buildSchema('f1', { result: calcField('addDays(ref(date), 2)') });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC base: 2026-02-14T13:00:00Z + 2 días = 2026-02-16T13:00:00.000Z
                expect(result.f1.result).toBe('2026-02-16T13:00:00.000Z');
            });

            it('should subDays on a date with Colombia offset and return UTC', () => {
                const auxCase = buildAuxCase('f1', { date: colombiaDate });
                const schema = buildSchema('f1', { result: calcField('subDays(ref(date), 3)') });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC base: 2026-02-14T13:00:00Z - 3 días = 2026-02-11T13:00:00.000Z
                expect(result.f1.result).toBe('2026-02-11T13:00:00.000Z');
            });

            it('should addHours on a date with Colombia offset and return UTC', () => {
                const auxCase = buildAuxCase('f1', { date: colombiaDate });
                const schema = buildSchema('f1', { result: calcField('addHours(ref(date), 5)') });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC base: 2026-02-14T13:00:00Z + 5 horas = 2026-02-14T18:00:00.000Z
                expect(result.f1.result).toBe('2026-02-14T18:00:00.000Z');
            });

            it('should diffDays between two dates with Colombia offset and return integer', () => {
                const auxCase = buildAuxCase('f1', {
                    a: '2026-02-20T08:00:00-05:00',
                    b: colombiaDate,
                });
                const schema = buildSchema('f1', { result: calcField('diffDays(ref(a), ref(b))') });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC: 2026-02-20T13:00:00Z - 2026-02-14T13:00:00Z = 6 días
                expect(result.f1.result).toBe(6);
            });
        });

        // Fecha proveniente de los logs reales: naive string sin timezone embebido,
        // el timezone está definido en el data_structure del campo (America/Bogota, UTC-5).
        // safeRef debe convertirla a UTC antes de pasarla a la función de cálculo.
        describe('naive date string resolved via field data_structure timezone', () => {
            // '2026-02-13T14:00:00.000' en America/Bogota (UTC-5) = '2026-02-13T19:00:00.000Z' en UTC
            const naiveBogotaDate = '2026-02-13T14:00:00.000';
            const expectedUTC = '2026-02-13T19:00:00.000Z';

            it('should convert naive Bogota date to UTC when field has timezone defined', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: naiveBogotaDate });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField('America/Bogota'),
                    result: calcField('addDays(ref(fecha_solicitud), 0)'),
                });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // 14:00 Bogota → 19:00 UTC, sin desplazamiento de días
                expect(result.f1.result).toBe(expectedUTC);
            });

            it('should addDays on naive Bogota date using UTC base and return UTC', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: naiveBogotaDate });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField('America/Bogota'),
                    result: calcField('addDays(ref(fecha_solicitud), 2)'),
                });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC base: 2026-02-13T19:00:00Z + 2 días = 2026-02-15T19:00:00.000Z
                expect(result.f1.result).toBe('2026-02-15T19:00:00.000Z');
            });

            it('should addMonths on naive Bogota date using UTC base and return UTC', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: naiveBogotaDate });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField('America/Bogota'),
                    result: calcField('addMonths(ref(fecha_solicitud), 1)'),
                });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // UTC base: 2026-02-13T19:00:00Z + 1 mes = 2026-03-13T19:00:00.000Z
                expect(result.f1.result).toBe('2026-03-13T19:00:00.000Z');
            });

            it('should NOT convert naive date when field has no timezone in data_structure', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: naiveBogotaDate });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField(), // sin timezone
                    result: calcField('addDays(ref(fecha_solicitud), 0)'),
                });

                const result = new AutoCalculatedFields(auxCase, schema).execute('create');

                // Sin timezone en el campo, el valor naive se trata como UTC directamente
                expect(result.f1.result).toBe('2026-02-13T14:00:00.000Z');
            });

            it('should return null and NOT throw when date field with timezone receives empty string', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: '' });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField('America/Bogota'),
                    result: calcField('addDays(ref(fecha_solicitud), 0)'),
                });

                // El valor vacío no es una fecha válida: safeRef lo retorna sin convertir,
                // y #evaluateFormula detecta '' y retorna null sin lanzar error
                expect(() => new AutoCalculatedFields(auxCase, schema).execute('create')).not.toThrow();
                const result = new AutoCalculatedFields(auxCase, schema).execute('create');
                expect(result.f1.result).toBeNull();
            });

            it('should return null and NOT throw when date field with timezone receives an invalid date string', () => {
                const auxCase = buildAuxCase('f1', { fecha_solicitud: 'not-a-date' });
                const schema = buildSchema('f1', {
                    fecha_solicitud: dateField('America/Bogota'),
                    result: calcField('addDays(ref(fecha_solicitud), 1)', { error_policy: 'empty' }),
                });

                // El string inválido no parsea como fecha: safeRef lo retorna sin convertir,
                // addDays lanza internamente y error_policy 'empty' absorbe el error retornando null
                expect(() => new AutoCalculatedFields(auxCase, schema).execute('create')).not.toThrow();
                const result = new AutoCalculatedFields(auxCase, schema).execute('create');
                expect(result.f1.result).toBeNull();
            });
        });
    });

    describe('execute() - string functions', () => {
        it('should evaluate concat(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 'hello', b: ' world' });
            const schema = buildSchema('f1', { result: calcField('concat(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('hello world');
        });

        it('should evaluate upper(ref(a))', () => {
            const auxCase = buildAuxCase('f1', { a: 'hello' });
            const schema = buildSchema('f1', { result: calcField('upper(ref(a))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('HELLO');
        });

        it('should evaluate lower(ref(a))', () => {
            const auxCase = buildAuxCase('f1', { a: 'HELLO' });
            const schema = buildSchema('f1', { result: calcField('lower(ref(a))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('hello');
        });

        it('should evaluate trim(ref(a))', () => {
            const auxCase = buildAuxCase('f1', { a: '  hello  ' });
            const schema = buildSchema('f1', { result: calcField('trim(ref(a))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('hello');
        });

        it('should evaluate slice(ref(a), 0, 3)', () => {
            const auxCase = buildAuxCase('f1', { a: 'abcdef' });
            const schema = buildSchema('f1', { result: calcField('slice(ref(a), 0, 3)') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe('abc');
        });
    });

    describe('execute() - comparator functions', () => {
        it('should evaluate eq(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 5 });
            const schema = buildSchema('f1', { result: calcField('eq(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(true);
        });

        it('should evaluate ne(ref(a), ref(b))', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 3 });
            const schema = buildSchema('f1', { result: calcField('ne(ref(a), ref(b))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(true);
        });

        it('should evaluate gt, gte, lt, lte', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 5 });
            const schema = buildSchema('f1', {
                gt_r: calcField('gt(ref(a), ref(b))'),
                gte_r: calcField('gte(ref(a), ref(b))'),
                lt_r: calcField('lt(ref(a), ref(b))'),
                lte_r: calcField('lte(ref(a), ref(b))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.gt_r).toBe(true);
            expect(result.f1.gte_r).toBe(true);
            expect(result.f1.lt_r).toBe(false);
            expect(result.f1.lte_r).toBe(false);
        });

        it('should evaluate and(...) / or(...)', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 5 });
            const schema = buildSchema('f1', {
                and_r: calcField('and(gt(ref(a), ref(b)), eq(ref(a), 10))'),
                or_r: calcField('or(lt(ref(a), ref(b)), eq(ref(b), 5))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.and_r).toBe(true);
            expect(result.f1.or_r).toBe(true);
        });

        it('should evaluate not()', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 10 });
            const schema = buildSchema('f1', {
                result: calcField('not(gt(ref(a), ref(b)))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(true);
        });
    });

    describe('execute() - utility functions', () => {
        it('should evaluate coalesce() returning first non-null', () => {
            const auxCase = buildAuxCase('f1', { a: null, b: undefined, c: 42 });
            const schema = buildSchema('f1', {
                result: calcField('coalesce(ref(a), ref(b), ref(c))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(42);
        });

        it('should evaluate iif(cond, a, b)', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 5, c: 100, d: 200 });
            const schema = buildSchema('f1', {
                result: calcField('iif(gt(ref(a), ref(b)), ref(c), ref(d))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(100);
        });

        it('should evaluate iif returning false branch', () => {
            const auxCase = buildAuxCase('f1', { a: 1, b: 5, c: 100, d: 200 });
            const schema = buildSchema('f1', {
                result: calcField('iif(gt(ref(a), ref(b)), ref(c), ref(d))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(200);
        });

        it('should evaluate len(ref(a))', () => {
            const auxCase = buildAuxCase('f1', { a: 'hello' });
            const schema = buildSchema('f1', { result: calcField('len(ref(a))') });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(5);
        });

        it('should map if() to iif() in formulas', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 5, c: 100, d: 200 });
            const schema = buildSchema('f1', {
                result: calcField('if(gt(ref(a), ref(b)), ref(c), ref(d))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(100);
        });
    });

    describe('execute() - null/undefined field handling', () => {
        it('should return null when referenced field is undefined', () => {
            const auxCase = buildAuxCase('f1', { a: 10 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), ref(b))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBeNull();
        });

        it('should return null when referenced field is null', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: null });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), ref(b))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBeNull();
        });

        it('should return null when referenced field is empty string', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: '' });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(a), ref(b))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBeNull();
        });

        it('should allow undefined fields when formula uses coalesce', () => {
            const auxCase = buildAuxCase('f1', { b: 99 });
            const schema = buildSchema('f1', {
                result: calcField('coalesce(ref(a), ref(b))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(99);
        });

        it('should allow undefined fields when formula uses iif', () => {
            const auxCase = buildAuxCase('f1', { a: true, b: 10, c: 20 });
            const schema = buildSchema('f1', {
                result: calcField('iif(ref(a), ref(b), ref(c))'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(10);
        });
    });

    describe('execute() - error handling', () => {
        it('should throw ValidationFailError when formula is missing', () => {
            const auxCase = buildAuxCase('f1', { a: 10 });
            const fieldConfig = {
                type: 'calculated',
                required: false,
                calc: { error_policy: 'error', on: ['create', 'update'] },
            };
            const schema = buildSchema('f1', { result: fieldConfig });

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(() => svc.execute('create')).toThrow(ValidationFailError);
        });

        it('should throw ValidationFailError when formula uses invalid function', () => {
            const auxCase = buildAuxCase('f1', { a: 10 });
            const schema = buildSchema('f1', {
                result: calcField('hackTheSystem(ref(a))'),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(() => svc.execute('create')).toThrow(ValidationFailError);
            expect(() => svc.execute('create')).toThrow(/Invalid function "hackTheSystem"/);
        });

        it('should throw on formula failure when error_policy is error (default)', () => {
            const auxCase = buildAuxCase('f1', { a: 'not_a_number', b: 5 });
            const schema = buildSchema('f1', {
                result: calcField('div(ref(a), ref(b))'),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(() => svc.execute('create')).toThrow();
        });

        it('should return null on formula failure when error_policy is empty', () => {
            const auxCase = buildAuxCase('f1', { a: 'not_a_number', b: 5 });
            const schema = buildSchema('f1', {
                result: calcField('div(ref(a), ref(b))', { error_policy: 'empty' }),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result.f1.result).toBeNull();
            expect(logErrorSpy).toHaveBeenCalled();
        });

        it('should throw when dividing by zero with error_policy error', () => {
            const auxCase = buildAuxCase('f1', { a: 10, b: 0 });
            const schema = buildSchema('f1', {
                result: calcField('div(ref(a), ref(b))'),
            });

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(() => svc.execute('create')).toThrow();
        });
    });

    describe('execute() - flat schema format', () => {
        it('should handle flat data structure (no formId wrapper in schema)', () => {
            const auxCase = buildAuxCase('f1', { a: 3, b: 7 });
            const schema = {
                value: {
                    result: calcField('sum(ref(a), ref(b))'),
                    a: { type: 'number', required: true },
                    b: { type: 'number', required: true },
                },
            };

            const svc = new AutoCalculatedFields(auxCase, schema);
            const result = svc.execute('create');

            expect(result.f1.result).toBe(10);
        });
    });

    describe('execute() - side effects', () => {
        it('should mutate auxCase.data.value[formId] with calculated results', () => {
            const auxCase = buildAuxCase('f1', { a: 5, b: 10 });
            const schema = buildSchema('f1', { total: calcField('sum(ref(a), ref(b))') });

            new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(auxCase.data.value.f1.total).toBe(15);
        });

        it('should process multiple forms and return all results', () => {
            const auxCase = {
                data: {
                    value: {
                        form1: { x: 2, y: 3 },
                        form2: { p: 10, q: 4 },
                    },
                },
                fields: null,
            };
            const schema = {
                value: {
                    form1: {
                        type: 'object',
                        required: false,
                        data_structure: { total: calcField('sum(ref(x), ref(y))') },
                    },
                    form2: {
                        type: 'object',
                        required: false,
                        data_structure: { diff: calcField('sub(ref(p), ref(q))') },
                    },
                },
            };

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.form1.total).toBe(5);
            expect(result.form2.diff).toBe(6);
        });

        it('should set auxCase.fields before evaluating each form', () => {
            const auxCase = buildAuxCase('f1', { a: 7 });
            const schema = buildSchema('f1', { double: calcField('mul(ref(a), 2)') });

            new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(auxCase.fields).toEqual({ a: 7 });
        });
    });

    describe('execute() - ref normalization', () => {
        it('should normalize ref(fieldName) to ref("fieldName")', () => {
            const auxCase = buildAuxCase('f1', { my_field: 42 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref(my_field), 8)'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(50);
        });

        it('should handle ref with already quoted field name', () => {
            const auxCase = buildAuxCase('f1', { a: 5 });
            const schema = buildSchema('f1', {
                result: calcField('sum(ref("a"), 10)'),
            });

            const result = new AutoCalculatedFields(auxCase, schema).execute('create');

            expect(result.f1.result).toBe(15);
        });
    });

    describe('constructor & getters', () => {
        it('should expose auxCase and dataStructure via getters', () => {
            const auxCase = buildAuxCase('f1', { a: 1 });
            const schema = buildSchema('f1', {});

            const svc = new AutoCalculatedFields(auxCase, schema);

            expect(svc.auxCase).toBe(auxCase);
            expect(svc.dataStructure).toBe(schema);
        });
    });
});
