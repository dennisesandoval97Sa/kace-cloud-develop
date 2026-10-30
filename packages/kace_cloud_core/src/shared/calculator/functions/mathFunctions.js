import { ValidationFailError } from '../../errors/ValidationFailError';

/**
 * Verify that the value is a valid number.
 */
function assertNumber(value, functionName) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ValidationFailError(`${functionName}() expected numeric values but received: ${value}`);
    }
}

/**
 * Sums all provided numbers.
 * @param {...number} args - Numbers to sum.
 * @returns {number} The sum of all numbers.
 */
export const sum = (...args) => {
    const numbers = args.map((v) => {
        assertNumber(v, 'sum');
        return v;
    });
    return numbers.reduce((acc, v) => acc + v, 0);
};

/**
 * Subtracts the second number from the first.
 * @param {number} a - Minuend.
 * @param {number} b - Subtrahend.
 * @returns {number} The result of a - b.
 */
export const sub = (a, b) => {
    assertNumber(a, 'sub');
    assertNumber(b, 'sub');
    return a - b;
};

/**
 * Multiplies two numbers.
 * @param {number} a - First factor.
 * @param {number} b - Second factor.
 * @returns {number} The product of a and b.
 */
export const mul = (a, b) => {
    assertNumber(a, 'mul');
    assertNumber(b, 'mul');
    return a * b;
};

/**
 * Divides the first number by the second.
 * @param {number} a - Dividend.
 * @param {number} b - Divisor.
 * @returns {number} The result of a / b.
 */
export const div = (a, b, decimals = 10) => {
    assertNumber(a, 'div');
    assertNumber(b, 'div');
    if (b === 0) throw new ValidationFailError('Division by zero');
    const factor = 10 ** decimals;
    return Math.round((a / b) * factor) / factor;
};

/**
 * Rounds a number to a specified number of decimal places.
 * @param {number} n - Number to round.
 * @param {number} d - Number of decimal places.
 * @returns {string} The rounded number as a string.
 */
export const round = (n, d) => {
    assertNumber(n, 'round');
    assertNumber(d, 'round');
    const factor = 10 ** d;
    return Math.round((Number(n) + 1e-10) * factor) / factor;
};

/**
 * Returns the minimum value among the provided numbers.
 * @param {...number} args - Numbers to compare.
 * @returns {number} The smallest number.
 */
export const min = (...args) => {
    const numbers = args.map((v) => {
        assertNumber(v, 'min');
        return v;
    });
    return Math.min(...numbers);
};

/**
 * Returns the maximum value among the provided numbers.
 * @param {...number} args - Numbers to compare.
 * @returns {number} The largest number.
 */
export const max = (...args) => {
    const numbers = args.map((v) => {
        assertNumber(v, 'max');
        return v;
    });
    return Math.max(...numbers);
};

export const mathFunctions = {
    sum,
    sub,
    mul,
    div,
    round,
    min,
    max,
};
