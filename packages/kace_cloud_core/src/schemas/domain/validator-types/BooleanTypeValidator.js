import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU.js';
import { AllowedAttributes } from './AllowedAttributes.js';

export class BooleanTypeValidator {
    validate(fieldName, config) {
        const allowed = [...AllowedAttributes, 'truthyValues', 'falsyValues', 'default', 'restflow_id'];

        this.rejectUnexpectedKeys(config, allowed, fieldName);

        if (config.hasOwnProperty('required') && typeof config.required !== 'boolean') {
            throw new ValidationFailError(`'${fieldName}.required' is required and must be a boolean.`, fieldName);
        }

        if (config.hasOwnProperty('truthyValues') && !Array.isArray(config.truthyValues)) {
            throw new ValidationFailError(`'${fieldName}.truthyValues' is required and must be an array.`, fieldName);
        }

        if (config.hasOwnProperty('falsyValues') && !Array.isArray(config.falsyValues)) {
            throw new ValidationFailError(`'${fieldName}.falsyValues' is required and must be an array.`, fieldName);
        }

        if (config.hasOwnProperty('restflow_id') && config.restflow_id) {
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectUuid('restflow_id', config.restflow_id);
        }

        ['truthyValues', 'falsyValues'].forEach((key) => {
            if (Array.isArray(config[key])) {
                if (config[key].length === 0) {
                    throw new ValidationFailError(`'${fieldName}.${key}' no puede ser un array vacío.`, fieldName);
                }
                const seen = new Set();
                config[key].forEach((val) => {
                    if (val === '' || val === null || val === undefined) {
                        throw new ValidationFailError(
                            `'${fieldName}.${key}' no puede contener valores vacíos, null o undefined.`,
                            fieldName
                        );
                    }
                    if (typeof val !== 'string' && typeof val !== 'number') {
                        throw new ValidationFailError(
                            `'${fieldName}.${key}' solo puede contener strings o números.`,
                            fieldName
                        );
                    }
                    if (seen.has(val)) {
                        throw new ValidationFailError(
                            `'${fieldName}.${key}' no puede contener valores duplicados.`,
                            fieldName
                        );
                    }
                    seen.add(val);
                });
            }
        });

        if (Array.isArray(config.truthyValues) && Array.isArray(config.falsyValues)) {
            const intersection = config.truthyValues.filter((val) => config.falsyValues.includes(val));
            if (intersection.length > 0) {
                throw new ValidationFailError(
                    `'${fieldName}.truthyValues' y '${fieldName}.falsyValues' no pueden tener valores en común: [${intersection.join(', ')}]`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('default')) {
            const def = config.default;
            if (typeof def !== 'boolean') {
                const inTruthy = Array.isArray(config.truthyValues) && config.truthyValues.includes(def);
                const inFalsy = Array.isArray(config.falsyValues) && config.falsyValues.includes(def);
                if (!inTruthy && !inFalsy) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe ser booleano o estar en truthyValues o falsyValues.`,
                        fieldName
                    );
                }
            }
        }

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
            Object.keys(config.sources).forEach((key) => {
                if (!allowedSourcesKeys.includes(key)) {
                    throw new ValidationFailError(
                        `'${fieldName}.sources' contiene la clave no permitida '${key}'.`,
                        fieldName
                    );
                }
                if (
                    config.sources[key] &&
                    typeof config.sources[key] === 'string' &&
                    !/^https?:\/\//.test(config.sources[key])
                ) {
                    throw new ValidationFailError(`'${fieldName}.sources.${key}' debe ser una URL válida.`, fieldName);
                }
            });
        }
    }

    rejectUnexpectedKeys(config, allowed, fieldName) {
        const keys = Object.keys(config).filter((k) => !allowed.includes(k));
        if (keys.length) {
            throw new ValidationFailError(
                `[BooleanTypeValidator] '${fieldName}' contains unsupported key(s): ${keys.join(', ')}.`,
                keys[0]
            );
        }
    }
}
