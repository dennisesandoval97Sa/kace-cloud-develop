import { ValidationFailError } from '../../errors/ValidationFailError.js';

/**
 * Verifies that a value is of type string or convertible to string.
 * @param {any} value
 * @param {string} functionName
 */
function validateString(value, functionName) {
    if (value === null || value === undefined) {
        throw new ValidationFailError(`Invalid value in ${functionName}: expected string, received ${value}`);
    }
}

/**
 * Concatenates all provided values into a single string.
 * @param {...string} args - Strings to concatenate.
 * @returns {string} The concatenated string.
 */
export const concat = (...args) => {
    if (!args.length) throw new ValidationFailError('concat() requires at least one argument');
    args.forEach((arg, idx) => {
        if (arg === null || arg === undefined)
            throw new ValidationFailError(`Invalid argument at position ${idx} in concat(): ${arg}`);
    });
    return args.map(String).join('');
};

/**
 * Converts a string to uppercase.
 * @param {string} s - The string to convert.
 * @returns {string} The uppercase string.
 */
export const upper = (s) => {
    validateString(s, 'upper');
    return String(s).toUpperCase();
};

/**
 * Converts a string to lowercase.
 * @param {string} s - The string to convert.
 * @returns {string} The lowercase string.
 */
export const lower = (s) => {
    validateString(s, 'lower');
    return String(s).toLowerCase();
};

/**
 * Trims whitespace from both ends of a string.
 * @param {string} s - The string to trim.
 * @returns {string} The trimmed string.
 */
export const trim = (s) => {
    validateString(s, 'trim');
    return String(s).trim();
};

/**
 * Returns a substring of a string from index `i` up to, but not including, index `j`.
 * @param {string} s - The original string.
 * @param {number} i - Start index.
 * @param {number} [j] - End index (optional).
 * @returns {string} The sliced substring.
 */
export const slice = (s, i, j) => {
    validateString(s, 'slice');
    if (typeof i !== 'number' || isNaN(i)) {
        throw new ValidationFailError(`Invalid start index in slice(): expected number, received ${i}`);
    }
    if (j !== undefined && (typeof j !== 'number' || isNaN(j))) {
        throw new ValidationFailError(`Invalid end index in slice(): expected number, received ${j}`);
    }
    return String(s).slice(i, j);
};

export const stringFunctions = {
    concat,
    upper,
    lower,
    trim,
    slice,
};
