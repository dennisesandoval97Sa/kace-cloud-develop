import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU.js';
import { AllowedAttributes } from './AllowedAttributes.js';

export class ObjectTypeValidator {
    validate(fieldName, config) {
        const allowed = [...AllowedAttributes, 'schema_id', 'data_structure'];
        this.rejectUnexpectedKeys(config, allowed, fieldName);

        if (config.hasOwnProperty('type') && config.type !== 'object') {
            throw new ValidationFailError(`[ObjectTypeValidator] '${fieldName}.type' must be 'object'.`, fieldName);
        }

        if (config.hasOwnProperty('required') && typeof config.required !== 'boolean') {
            throw new ValidationFailError(`[ObjectTypeValidator] '${fieldName}.required' must be boolean.`, fieldName);
        }

        if (config.hasOwnProperty('schema_id') && config.schema_id) {
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectUuid('schema_id', config.schema_id);
        }

        if (config.hasOwnProperty('data_structure') && typeof config.data_structure !== 'object') {
            throw new ValidationFailError(`'${fieldName}.data_structure' debe ser un objeto.`, fieldName);
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
                `[ObjectTypeValidator] '${fieldName}' contains unsupported key(s): ${keys.join(', ')}.`,
                keys[0]
            );
        }
    }
}
