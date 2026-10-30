import { ValidationFailError } from '../../errors/ValidationFailError';

/**
 * Ensures the values are comparable (number, string, or Date).
 * @param {any} a
 * @param {any} b
 * @param {string} fnName
 */
const validateComparable = (a, b, fnName) => {
    const validTypes = ['number', 'string'];
    const isDateA = a instanceof Date;
    const isDateB = b instanceof Date;

    if ((!validTypes.includes(typeof a) && !isDateA) || (!validTypes.includes(typeof b) && !isDateB)) {
        throw new ValidationFailError(
            `${fnName}() expects comparable values (number, string, or Date), got ${typeof a} and ${typeof b}`
        );
    }
};

/**
 * Checks if two values are strictly equal.
 */
export const eq = (a, b) => a === b;

/**
 * Checks if two values are not strictly equal.
 */
export const ne = (a, b) => a !== b;

/**
 * Checks if the first value is greater than the second.
 */
export const gt = (a, b) => {
    validateComparable(a, b, 'gt');
    return a > b;
};

/**
 * Checks if the first value is greater than or equal to the second.
 */
export const gte = (a, b) => {
    validateComparable(a, b, 'gte');
    return a >= b;
};

/**
 * Checks if the first value is less than the second.
 */
export const lt = (a, b) => {
    validateComparable(a, b, 'lt');
    return a < b;
};

/**
 * Checks if the first value is less than or equal to the second.
 */
export const lte = (a, b) => {
    validateComparable(a, b, 'lte');
    return a <= b;
};

/**
 * Returns true if all provided values are truthy.
 * @param {...any} args - Values to evaluate.
 * @returns {boolean} True if all values are truthy.
 * @throws {ValidationFailError} If no arguments are provided.
 */
export const and = (...args) => {
    if (!args.length) {
        throw new ValidationFailError('and() requires at least one argument');
    }
    return args.every(Boolean);
};

/**
 * Returns true if at least one provided value is truthy.
 * @param {...any} args - Values to evaluate.
 * @returns {boolean} True if any value is truthy.
 * @throws {ValidationFailError} If no arguments are provided.
 */
export const or = (...args) => {
    if (!args.length) {
        throw new ValidationFailError('or() requires at least one argument');
    }
    return args.some(Boolean);
};

/**
 * Returns the logical negation of a value.
 * @param {any} a - The value to negate.
 * @returns {boolean} True if `a` is falsy, false if `a` is truthy.
 * @throws {ValidationFailError} If value is undefined.
 */
export const not = (a) => {
    if (typeof a === 'undefined') {
        throw new ValidationFailError('not() requires one argument');
    }
    return !a;
};

export const comparatorFunctions = {
    eq,
    ne,
    gt,
    gte,
    lt,
    lte,
    and,
    or,
    not,
};
