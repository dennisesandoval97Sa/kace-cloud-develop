/**
 * Domain service for object and value comparison operations
 * Following DDD principles - this is a stateless service
 */
export class ComparisonService {
    /**
     * Performs deep comparison between two values
     * @param {any} value1 - First value to compare
     * @param {any} value2 - Second value to compare
     * @returns {boolean} True if values are deeply equal
     */
    static deepEqual(value1, value2) {
        if (value1 === value2) return true;

        if (value1 == null || value2 == null) return value1 === value2;

        if (typeof value1 !== typeof value2) return false;

        if (typeof value1 !== 'object') return value1 === value2;

        if (Array.isArray(value1) && Array.isArray(value2)) {
            return this.#compareArrays(value1, value2);
        }

        if (Array.isArray(value1) || Array.isArray(value2)) return false;

        return this.#compareObjects(value1, value2);
    }

    /**
     * Private method to compare arrays
     * @param {Array} arr1
     * @param {Array} arr2
     * @returns {boolean}
     */
    static #compareArrays(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;

        for (let i = 0; i < arr1.length; i++) {
            if (!this.deepEqual(arr1[i], arr2[i])) return false;
        }

        return true;
    }

    /**
     * Private method to compare objects
     * @param {Object} obj1
     * @param {Object} obj2
     * @returns {boolean}
     */
    static #compareObjects(obj1, obj2) {
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }

        return true;
    }
}
