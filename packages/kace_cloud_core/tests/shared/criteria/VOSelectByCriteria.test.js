import { VOSelectByCriteria } from '../../../src/shared/criteria/VOSelectByCriteria.js';
import { InvalidArgumentError } from '../../../src/shared/errors/InvalidArgumentError.js';

describe('VOSelectByCriteria', () => {
    test('should allow valid object structure and function', () => {
        const validSelect = [
            {
                function: 'count',
                alias: 'total',
                field: 'ans.id'
            }
        ];
        expect(() => new VOSelectByCriteria('select', validSelect)).not.toThrow();
    });

    test('should allow other valid functions', () => {
        const functions = ['sum', 'avg', 'min', 'max'];
        functions.forEach(func => {
            const validSelect = [
                {
                    function: func,
                    alias: 'result',
                    field: 'table.field'
                }
            ];
            expect(() => new VOSelectByCriteria('select', validSelect)).not.toThrow();
        });
    });

    test('should throw error if object structure is invalid (missing properties)', () => {
        const invalidSelect = [
            {
                function: 'count',
                alias: 'total'
            }
        ];
        expect(() => new VOSelectByCriteria('select', invalidSelect)).toThrow(InvalidArgumentError);
        expect(() => new VOSelectByCriteria('select', invalidSelect)).toThrow(/The object structure is invalid/);
    });

    test('should throw error if function is not allowed', () => {
        const invalidSelect = [
            {
                function: 'invalid_func',
                alias: 'total',
                field: 'ans.id'
            }
        ];
        expect(() => new VOSelectByCriteria('select', invalidSelect)).toThrow(InvalidArgumentError);
        expect(() => new VOSelectByCriteria('select', invalidSelect)).toThrow(/The function 'invalid_func' is not allowed/);
    });
});
