import { ArrayMerger } from '../utilities/ArrayMerger.js';

export class DeepMergeAuxiliariesData {
    /**
     * Recursively merges source object into target object
     * @param {Object} target - The target object to merge into
     * @param {Object} source - The source object to merge from
     * @returns {Object} A new merged object
     */
    static execute(target, source, shouldOverrideArray = false) {
        const isValidObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
        if (!isValidObject(target) || !isValidObject(source) || Array.isArray(source)) {
            return target;
        }

        const output = { ...target };

        for (const key of Object.keys(source)) {
            if (!output[key]) {
                output[key] = source[key];
            } else {
                if (shouldOverrideArray && Array.isArray(output[key])) {
                    output[key] = source[key];
                } else {
                    output[key] = this.#mergeProperty(output[key], source[key], shouldOverrideArray);
                }
            }
        }

        return output;
    }

    /**
     * Merges a single property based on its type
     * @param {*} targetValue - The current value in target
     * @param {*} sourceValue - The new value from source
     * @returns {*} The merged value
     */
    static #mergeProperty(targetValue, sourceValue, shouldOverrideArray = false) {
        if (Array.isArray(targetValue)) {
            if (shouldOverrideArray) return sourceValue;
            return ArrayMerger.addOrMerge(targetValue, sourceValue);
        }

        if (sourceValue && typeof sourceValue === 'object') {
            return this.execute(targetValue || {}, sourceValue, shouldOverrideArray);
        }

        return sourceValue;
    }
}
