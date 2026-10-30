import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { ConfigurationAggregate } from './ConfigurationAggregate';
import { Helper } from '../../../shared/index.js';

export class CustomFields extends ConfigurationAggregate {
    static #EXPECTED_STRUCTURE = {
        application: {
            admin: {},
            agente: {
                flow_id: '',
                execute_ws_restflow: true,
            },
        },
    };

    constructor(data) {
        super('custom_fields', data);
        this.ensureDataStructure(data);
    }

    ensureDataStructure(data) {
        const unexpectedKeys = [];
        this.#validateKeysRecursively(CustomFields.#EXPECTED_STRUCTURE, data, 'custom_fields', unexpectedKeys);
        if (unexpectedKeys.length > 0) {
            Helper.logWarning(
                `Invalid Layouts structure (settings.custom_fields). Unexpected keys: ${unexpectedKeys.join(', ')}`
            );
        }
    }

    #validateKeysRecursively(expected, actual, path, unexpectedKeys) {
        for (const key of Object.keys(expected)) {
            const expectedValue = expected[key];

            if (actual === undefined || actual === null || !(key in actual)) {
                if (actual && typeof actual === 'object') {
                    actual[key] = Array.isArray(expectedValue) ? [...expectedValue] : expectedValue;
                }
                continue;
            }

            if (
                expectedValue !== null &&
                typeof expectedValue === 'object' &&
                !Array.isArray(expectedValue) &&
                Object.keys(expectedValue).length > 0
            ) {
                this.#validateKeysRecursively(expectedValue, actual[key], `${path}.${key}`, unexpectedKeys);
            }
        }
        if (actual !== undefined && actual !== null && typeof actual === 'object' && !Array.isArray(actual)) {
            for (const key of Object.keys(actual)) {
                if (!(key in expected)) {
                    unexpectedKeys.push(`${path}.${key}`);
                }
            }
        }
    }
}
