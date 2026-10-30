import { ValidationFailError } from '../../errors/ValidationFailError';
import { ComparisonService } from '../services/ComparisonService';

/**
 * Utility class for merging arrays with duplicate prevention
 *
 * @class ArrayMerger
 * @example
 * const result = ArrayMerger.merge(['a', 'b'], ['b', 'c']);
 * console.log(result); // ['a', 'b', 'c']
 */
export class ArrayMerger {
    static #safeClone(value) {
        const isObject = value !== null && typeof value === 'object';
        if (!isObject) return value;

        try {
            return structuredClone(value);
        } catch (e) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch {
                // SI: No es necesario capturar la excepcion se retorna el valor original en caso de fallo
                return value;
            }
        }
    }

    /**
     * Merges two arrays while preventing duplicate entries
     *
     * @param {Array} currentArray - The base array to merge into
     * @param {Array} newArray - The array containing new elements to add
     * @returns {Array} A new array containing unique elements from both input arrays
     *
     * @throws {TypeError} When either parameter is not an array
     */
    static merge(currentArray, newArray) {
        if (!Array.isArray(currentArray)) {
            throw new ValidationFailError(
                `Expected currentArray to be an array, got ${typeof currentArray}`,
                'currentArray'
            );
        }

        if (!Array.isArray(newArray)) {
            throw new ValidationFailError(`Expected newArray to be an array, got ${typeof newArray}`, 'newArray');
        }

        const result = [...currentArray];

        for (const element of newArray) {
            if (!this.#containsElement(result, element)) {
                result.push(this.#safeClone(element));
            }
        }

        return result;
    }

    /**
     * Adds a single value to an array if it doesn't already exist
     *
     * @param {Array} currentArray - The base array to add the value to
     * @param {*} value - The value to add
     * @returns {Array} A new array containing the original elements plus the new value (if unique)
     *
     * @throws {ValidationFailError} When currentArray is not an array
     */
    static addValue(currentArray, value) {
        if (!Array.isArray(currentArray)) {
            throw new ValidationFailError(
                `Expected currentArray to be an array, got ${typeof currentArray}`,
                'currentArray'
            );
        }

        const result = [...currentArray];

        if (!this.#containsElement(result, value)) {
            result.push(this.#safeClone(value));
        }

        return result;
    }

    /**
     * Automatically merges arrays or adds single values based on the input type
     * If newData is an array, performs merge(); if it's a primitive/object, performs addValue()
     *
     * @param {Array} currentArray - The base array to modify
     * @param {*} newData - Either an array to merge or a single value to add
     * @returns {Array} A new array with the data merged or added
     *
     * @throws {ValidationFailError} When currentArray is not an array
     */
    static addOrMerge(currentArray, newData) {
        if (!Array.isArray(currentArray)) {
            throw new ValidationFailError(
                `Expected currentArray to be an array, got ${typeof currentArray}`,
                'currentArray'
            );
        }

        if (Array.isArray(newData)) {
            return this.merge(currentArray, newData);
        } else {
            return this.addValue(currentArray, newData);
        }
    }

    /**
     * Merges multiple arrays at once
     *
     * @param {...Array} arrays - Variable number of arrays to merge
     * @returns {Array} A new array containing unique elements from all input arrays
     *
     * @throws {TypeError} When any parameter is not an array
     */
    static mergeMultiple(...arrays) {
        if (arrays.length === 0) {
            return [];
        }

        arrays.forEach((arr, index) => {
            if (!Array.isArray(arr)) {
                throw new TypeError(`Expected argument ${index} to be an array, got ${typeof arr}`);
            }
        });

        return arrays.reduce((accumulator, currentArray) => this.merge(accumulator, currentArray), []);
    }

    /**
     * Checks if an element exists in the array
     * Handles both primitive types and objects through deep comparison
     *
     * @param {Array} array - The array to search in
     * @param {*} element - The element to search for
     * @returns {boolean} True if the element exists in the array
     */
    static #containsElement(array, element) {
        return array.some((item) => ComparisonService.deepEqual(item, element));
    }
}
