import { ValidationFailError } from '../../../../src/shared';
import { mathFunctions } from '../../../../src/shared/calculator/functions/mathFunctions';

describe('mathFunctions', () => {
    describe('sum', () => {
        it('sums multiple numbers correctly', () => {
            expect(mathFunctions.sum(1, 2, 3, 4)).toBe(10);
            expect(mathFunctions.sum(-1, 1)).toBe(0);
            expect(mathFunctions.sum()).toBe(0);
        });
    });

    describe('sub', () => {
        it('subtracts numbers correctly', () => {
            expect(mathFunctions.sub(10, 3)).toBe(7);
            expect(mathFunctions.sub(0, 5)).toBe(-5);
        });
    });

    describe('mul', () => {
        it('multiplies numbers correctly', () => {
            expect(mathFunctions.mul(2, 3)).toBe(6);
            expect(mathFunctions.mul(5, 0)).toBe(0);
            expect(mathFunctions.mul(-2, 4)).toBe(-8);
        });
    });

    describe('div', () => {
        it('divides numbers correctly with default decimals', () => {
            expect(mathFunctions.div(10, 2)).toBe(5);
            expect(mathFunctions.div(1, 3)).toBeCloseTo(0.3333333333, 10);
        });

        it('divides numbers correctly with custom decimals', () => {
            expect(mathFunctions.div(1, 3, 2)).toBe(0.33);
        });

        it('throws error when dividing by zero', () => {
            expect(() => mathFunctions.div(10, 0)).toThrow(ValidationFailError);
            expect(() => mathFunctions.div(10, 0)).toThrow('Division by zero');
        });
    });

    describe('round', () => {
        it('rounds numbers correctly', () => {
            expect(mathFunctions.round(1.2345, 2)).toBe(1.23);
            expect(mathFunctions.round(1.2355, 2)).toBe(1.24);
            expect(mathFunctions.round(-1.2355, 2)).toBe(-1.24);
        });
    });

    describe('min', () => {
        it('returns the minimum value', () => {
            expect(mathFunctions.min(3, 1, 4, 2)).toBe(1);
            expect(mathFunctions.min(-1, -5, 0)).toBe(-5);
        });
    });

    describe('max', () => {
        it('returns the maximum value', () => {
            expect(mathFunctions.max(3, 1, 4, 2)).toBe(4);
            expect(mathFunctions.max(-1, -5, 0)).toBe(0);
        });
    });
});
