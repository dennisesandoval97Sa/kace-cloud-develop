import { Guards } from '../guards/Guards.js';
import { SQLInjectionCriteriaGuard } from '../guards/SQLInjectionCriteriaGuard.js';
import { XSSSchemaGuard } from '../guards/XSSSchemaGuard.js';

export class ValueObjectJson {
    /** @type {JSON} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        this.#value = value;
        this.field = field;
        if (!value && !nullable) {
            throw new Error(`${field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            this.#value = typeof value === 'string' ? JSON.parse(value) : value;
            Guards.objectType(this);
            this.#validateJsonRecursively(this.#value, field);
        }
    }

    get value() {
        return this.#value;
    }

    /**
     * Validates recursively all keys and string values in a JSON structure
     * using SQLInjectionGuard and XSSGuard dictionaries.
     *
     * @param {*} value - The value to validate (can be object, array, string, or primitive)
     * @param {string} fieldPath - The current path in the JSON structure (for error messages)
     * @param {boolean} both - When true validates both keys and values, when false only values
     * @private
     */
    #validateJsonRecursively(value, fieldPath, both = false) {
        if (value === null || value === undefined) {
            return;
        }

        if (typeof value === 'string') {
            SQLInjectionCriteriaGuard.validate(value, fieldPath);
            XSSSchemaGuard.validate(value);
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                const itemPath = `${fieldPath}[${index}]`;
                this.#validateJsonRecursively(item, itemPath, both);
            });
            return;
        }

        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, val]) => {
                if (both) {
                    const keyPath = `${fieldPath}["${key}"]`;
                    SQLInjectionCriteriaGuard.validate(key, keyPath);
                    XSSSchemaGuard.validate(key);
                }

                const nestedPath = `${fieldPath}.${key}`;
                this.#validateJsonRecursively(val, nestedPath, both);
            });
            return;
        }
    }
}
