import { ValidationFailError, ValueObjectJson } from '../../shared/index.js';
import { validatorTypes } from './validator-types/ValidatorTypes.js';

export class VODataStructure extends ValueObjectJson {
    constructor(value) {
        super('data_structure', value, false);
        this.validateStructure(value);
    }

    validateStructure(structure) {
        if (Object.entries(structure).length === 0) {
            throw new ValidationFailError(`data_structure cannot be empty`, 'data_structure');
        }

        for (const [fieldName, config] of Object.entries(structure)) {
            if (!/^[a-zA-Z0-9_-]+$/.test(fieldName)) {
                throw new ValidationFailError(
                    `Field '${fieldName}' is invalid: only letters, numbers, and underscores (_) are allowed.`,
                    fieldName
                );
            }

            if (fieldName.length > 45) {
                throw new ValidationFailError(
                    `Field '${fieldName}' is too long: maximum length is 45 characters.`,
                    fieldName
                );
            }

            if (typeof config !== 'object' || config === null) {
                throw new ValidationFailError(`Field '${fieldName}' must be a configuration object.`, fieldName);
            }

            const { type, required, unique, dependency, dependsOn, dependencyValueValidation, dependencyValue } =
                config;

            if (!type) {
                throw new ValidationFailError(`Field '${fieldName}' must include a 'type' property.`, fieldName);
            }

            if (required === undefined) {
                throw new ValidationFailError(`Field '${fieldName}' must include a 'required' property.`, fieldName);
            }

            if (!Object.keys(validatorTypes).includes(type)) {
                throw new ValidationFailError(
                    `Field '${fieldName}' has unsupported type '${type}'. Allowed types: ${Object.keys(validatorTypes).join(', ')}.`,
                    type
                );
            }

            if (typeof required !== 'boolean') {
                throw new ValidationFailError(`Field '${fieldName}.required' must be a boolean.`, fieldName);
            }

            if (unique !== undefined) {
                if (typeof unique !== 'boolean') {
                    throw new ValidationFailError(`Field '${fieldName}.unique' must be a boolean.`, fieldName);
                }
                const nonScalarTypes = ['array', 'object'];
                if (unique === true && nonScalarTypes.includes(type)) {
                    throw new ValidationFailError(
                        `Field '${fieldName}.unique' is not supported for type '${type}'. Use scalar types (string, number, boolean, date, calculated).`,
                        fieldName
                    );
                }
            }

            if (dependency !== undefined && typeof dependency !== 'boolean') {
                throw new ValidationFailError(`Field '${fieldName}.dependency' must be a boolean.`, fieldName);
            }

            if (dependencyValueValidation !== undefined && typeof dependencyValueValidation !== 'boolean') {
                throw new ValidationFailError(
                    `Field '${fieldName}.dependencyValueValidation' must be a boolean.`,
                    fieldName
                );
            }

            if (dependencyValueValidation === true && dependency !== true) {
                throw new ValidationFailError(
                    `Field '${fieldName}.dependencyValueValidation' requires 'dependency' to be true.`,
                    fieldName
                );
            }

            if (dependencyValueValidation === true) {
                if (!dependencyValue || typeof dependencyValue !== 'string' || dependencyValue.trim() === '') {
                    throw new ValidationFailError(
                        `Field '${fieldName}.dependencyValue' must be a non-empty string when 'dependencyValueValidation' is true.`,
                        fieldName
                    );
                }
            }

            if (dependency === true) {
                if (!dependsOn) {
                    throw new ValidationFailError(
                        `Field '${fieldName}' has 'dependency' set to true but 'dependsOn' is missing.`,
                        fieldName
                    );
                }
                if (typeof dependsOn !== 'string') {
                    throw new ValidationFailError(
                        `Field '${fieldName}.dependsOn' must be a string referencing another field.`,
                        fieldName
                    );
                }
                if (dependsOn === fieldName) {
                    throw new ValidationFailError(`Field '${fieldName}.dependsOn' cannot reference itself.`, fieldName);
                }
                if (!Object.prototype.hasOwnProperty.call(structure, dependsOn)) {
                    throw new ValidationFailError(
                        `Field '${fieldName}.dependsOn' references unknown field '${dependsOn}'.`,
                        fieldName
                    );
                }
            } else if (dependsOn !== undefined && dependsOn !== null && dependsOn !== '') {
                if (typeof dependsOn !== 'string') {
                    throw new ValidationFailError(`Field '${fieldName}.dependsOn' must be a string.`, fieldName);
                }
            }

            const validator = validatorTypes[type];
            validator.validate(fieldName, config, structure);
        }
    }
}
