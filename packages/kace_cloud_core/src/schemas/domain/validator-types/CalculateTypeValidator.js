import { ValidationFailError } from '../../../shared';
import { FormulaFunctionsValidator } from '../FormulaFunctionsValidator';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU';
import { AllowedAttributes } from './AllowedAttributes.js';
export class CalculateTypeValidator {
    validate(fieldName, config, data_structure) {
        const allowedKeys = [...AllowedAttributes];

        const invalidKeys = Object.keys(config).filter((key) => !allowedKeys.includes(key));

        if (config.hasOwnProperty('ui')) {
            if (typeof config.ui !== 'object' || Array.isArray(config.ui)) {
                throw new ValidationFailError(`'${fieldName}.ui' debe ser un objeto.`, fieldName);
            }
            const allowedUiKeys = [
                'label',
                'css',
                'input_type',
                'show_in_grid',
                'read_only',
                'is_visible',
                'ui_modified',
            ];
            Object.keys(config.ui).forEach((key) => {
                if (!allowedUiKeys.includes(key)) {
                    throw new ValidationFailError(
                        `'${fieldName}.ui' contiene la clave no permitida '${key}'.`,
                        fieldName
                    );
                }
            });
            if (config.ui.label && typeof config.ui.label !== 'string') {
                throw new ValidationFailError(`'${fieldName}.ui.label' debe ser string.`, fieldName);
            }
            if (config.ui.css && typeof config.ui.css !== 'string') {
                throw new ValidationFailError(`'${fieldName}.ui.css' debe ser string.`, fieldName);
            }
            if (config.ui.input_type && !VALID_INPUT_TYPES.includes(config.ui.input_type)) {
                throw new ValidationFailError(`'${fieldName}.ui.input_type' tiene un valor inválido.`, fieldName);
            }
            ['show_in_grid', 'read_only', 'is_visible', 'ui_modified'].forEach((boolKey) => {
                if (config.ui.hasOwnProperty(boolKey) && typeof config.ui[boolKey] !== 'boolean') {
                    throw new ValidationFailError(`'${fieldName}.ui.${boolKey}' debe ser booleano.`, fieldName);
                }
            });
        }

        if (config.hasOwnProperty('sources')) {
            if (typeof config.sources !== 'object' || Array.isArray(config.sources)) {
                throw new ValidationFailError(`'${fieldName}.sources' debe ser un objeto.`, fieldName);
            }

            const allowedSourcesKeys = ['literals_source', 'auxiliaries_source', 'entities_source', 'restflow_source'];

            for (const [key, value] of Object.entries(config.sources)) {
                if (!allowedSourcesKeys.includes(key)) {
                    throw new ValidationFailError(
                        `'${fieldName}.sources' contiene la clave no permitida '${key}'.`,
                        fieldName
                    );
                }

                if (value && typeof value === 'string' && !/^https?:\/\//.test(value)) {
                    throw new ValidationFailError(`'${fieldName}.sources.${key}' debe ser una URL válida.`, fieldName);
                }
            }
        }

        FormulaFunctionsValidator.validate(config.calc.formula, data_structure);

        if (invalidKeys.length > 0) {
            throw new ValidationFailError(
                `[CalculateTypeValidator] '${fieldName}' contains unsupported key(s): ${invalidKeys.join(', ')}.`,
                fieldName
            );
        }

        if (!config.calc || typeof config.calc !== 'object') {
            throw new ValidationFailError(`'${fieldName}' must include a 'calc' object.`, fieldName);
        }

        if (!config.calc.formula || typeof config.calc.formula !== 'string') {
            throw new ValidationFailError(`'${fieldName}' must include a valid 'calc.formula' string.`, fieldName);
        }

        if (!Array.isArray(config.calc.on) || config.calc.on.length === 0) {
            throw new ValidationFailError(`'${fieldName}.calc.on' must be a non-empty array.`, fieldName);
        }

        const validPolicies = ['error', 'empty'];
        if (!config.calc.error_policy || !validPolicies.includes(config.calc.error_policy)) {
            throw new ValidationFailError(
                `'${fieldName}.calc.error_policy' must be one of: ${validPolicies.join(', ')}.`,
                fieldName
            );
        }

        if (config.calc && Array.isArray(config.calc.on)) {
            const allowedOnValues = ['create', 'update'];
            for (const event of config.calc.on) {
                if (!allowedOnValues.includes(event)) {
                    throw new ValidationFailError(
                        `'${fieldName}.calc.on' contiene valor inválido: ${event}`,
                        fieldName
                    );
                }
            }
        }
    }
}
