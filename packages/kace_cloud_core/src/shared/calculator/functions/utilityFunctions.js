import { ValidationFailError } from '../../errors/ValidationFailError';

/**
 * Throws an error if used without initialization.
 * @throws {Error} Always throws an error indicating ref() is not initialized.
 */
export const ref = () => {
    throw new Error('ref() is not initialized');
};

/**
 * Returns the first non-null and non-undefined value from the provided list.
 * @param {...any} args - Values to check.
 * @returns {any} The first non-null/undefined value, or undefined if none found.
 * @throws {ValidationFailError} If no arguments are provided.
 */
export const coalesce = (...args) => {
    if (!args.length) {
        throw new ValidationFailError('coalesce() requires at least one argument');
    }
    return args.find((x) => x != null);
};

/**
 * Returns `a` if the condition is true, otherwise returns `b`.
 * @param {boolean} cond - The condition to evaluate.
 * @param {any} a - Value to return if condition is true.
 * @param {any} b - Value to return if condition is false.
 * @returns {any} Either `a` or `b` depending on the condition.
 * @throws {ValidationFailError} If `cond` is not a boolean.
 */
export const iif = (cond, a, b) => {
    if (typeof cond !== 'boolean') {
        throw new ValidationFailError('iif() expects the first argument to be a boolean');
    }
    return cond ? a : b;
};

/**
 * Returns the length of the value converted to a string.
 * @param {any} x - Value to measure.
 * @returns {number} Length of the string representation of `x`.
 * @throws {ValidationFailError} If value is null or undefined.
 */
export const len = (x) => {
    if (x == null) {
        throw new ValidationFailError('len() cannot operate on null or undefined');
    }
    return String(x).length;
};

/**
 * Grouping object containing all general utility functions.
 */
export const utilityFunctions = {
    ref,
    coalesce,
    iif,
    len,
};
