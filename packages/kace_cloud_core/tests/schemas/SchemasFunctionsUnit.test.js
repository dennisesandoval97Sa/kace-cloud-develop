import { SchemaFunctionsService } from '../../src/schemas/application/functions/SchemaFunctionsService';

describe('SchemaFunctionsService', () => {
    let service;

    beforeEach(() => {
        service = new SchemaFunctionsService();
    });

    it('should return an object containing data with all categories', () => {
        const result = service.getAll();
        expect(result).toHaveProperty('data');
        const { data } = result;

        expect(data).toHaveProperty('dates');
        expect(data).toHaveProperty('math');
        expect(data).toHaveProperty('chains');
        expect(data).toHaveProperty('utilities');
        expect(data).toHaveProperty('comparators');
    });

    it('should contain expected functions in dates category', () => {
        const { dates } = service.getAll().data;
        const functionNames = dates.map((f) => f.name);
        expect(functionNames).toEqual([
            'addDays',
            'addMonths',
            'addHours',
            'addMinutes',
            'startOfMonth',
            'endOfMonth',
            'diffDays',
            'addYears',
            'subDays',
            'subMonths',
            'subYears',
            'subHours',
            'subMinutes',
            'now',
        ]);
    });

    it('should contain variadic parameters in math sum, min, max', () => {
        const { math } = service.getAll().data;

        const variadicFuncs = math.filter((f) => f.params.some((p) => p.variadic));
        const names = variadicFuncs.map((f) => f.name);
        expect(names).toEqual(['sum', 'min', 'max']);

        variadicFuncs.forEach((func) => {
            expect(func.params[0]).toMatchObject({ name: 'values', type: 'number', variadic: true });
        });
    });

    it('should define proper parameter types in comparators', () => {
        const { comparators } = service.getAll().data;

        const lte = comparators.find((f) => f.name === 'lte');
        expect(lte.params).toEqual([
            { name: 'a', type: 'number|string' },
            { name: 'b', type: 'number|string' },
        ]);

        const eq = comparators.find((f) => f.name === 'eq');
        expect(eq.params).toEqual([
            { name: 'a', type: 'any' },
            { name: 'b', type: 'any' },
        ]);
    });

    it('should include variadic logic params in and/or/not', () => {
        const { comparators } = service.getAll().data;

        ['and', 'or', 'not'].forEach((fn) => {
            const item = comparators.find((f) => f.name === fn);
            expect(item).toBeDefined();
            expect(item.params.some((p) => p.variadic)).toBe(true);
        });
    });

    it('should contain expected chain functions', () => {
        const { chains } = service.getAll().data;
        const functionNames = chains.map((f) => f.name);
        expect(functionNames).toEqual(['concat', 'upper', 'lower', 'trim', 'slice']);
    });

    it('should have correct structure in utilities functions', () => {
        const { utilities } = service.getAll().data;
        const names = utilities.map((f) => f.name);
        expect(names).toEqual(['ref', 'coalesce', 'if', 'len']);

        const coalesce = utilities.find((f) => f.name === 'coalesce');
        expect(coalesce.params).toEqual([
            { name: 'a', type: 'any' },
            { name: 'b', type: 'any' },
        ]);

        const ifFn = utilities.find((f) => f.name === 'if');
        expect(ifFn.params[0]).toEqual({ name: 'cond', type: 'boolean' });
    });
});
