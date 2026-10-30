import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU.js';
import { AllowedAttributes } from './AllowedAttributes.js';

export class NumberTypeValidator {
    validate(fieldName, config) {
        const allowed = [
            ...AllowedAttributes,
            'integer',
            'min',
            'max',
            'greater',
            'less',
            'precision',
            'multiple',
            'positive',
            'negative',
            'unsafe',
            'port',
            'valid',
            'invalid',
            'default',
            'restflow_id',
        ];

        this.rejectUnexpectedKeys(config, allowed, fieldName);

        if (config.hasOwnProperty('integer') && typeof config.integer !== 'boolean') {
            throw new ValidationFailError(`'${fieldName}.integer' is required and must be a boolean.`, fieldName);
        }

        ['min', 'max', 'greater', 'less', 'precision', 'multiple', 'default'].forEach((key) => {
            if (config.hasOwnProperty(key) && typeof config[key] !== 'number') {
                throw new ValidationFailError(`'${fieldName}.${key}' is required and must be a number.`, fieldName);
            }
        });

        ['positive', 'negative', 'unsafe', 'port'].forEach((key) => {
            if (config.hasOwnProperty(key) && typeof config[key] !== 'boolean') {
                throw new ValidationFailError(`'${fieldName}.${key}' is required and must be a boolean.`, fieldName);
            }
        });

        if (config.hasOwnProperty('valid') && !Array.isArray(config.valid)) {
            throw new ValidationFailError(`'${fieldName}.valid' is required and must be an array.`, fieldName);
        }

        if (config.hasOwnProperty('invalid') && !Array.isArray(config.invalid)) {
            throw new ValidationFailError(`'${fieldName}.invalid' is required and must be an array.`, fieldName);
        }

        if (config.hasOwnProperty('restflow_id') && config.restflow_id) {
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectUuid('restflow_id', config.restflow_id);
        }

        if (config.hasOwnProperty('positive') && config.hasOwnProperty('negative')) {
            if (config.positive === false && config.negative === false) {
                throw new ValidationFailError(
                    `'${fieldName}' no puede tener 'positive' y 'negative' ambos en false. Al menos uno debe ser true.`,
                    fieldName
                );
            }
        }

        if (Array.isArray(config.valid) && Array.isArray(config.invalid)) {
            const intersection = config.valid.filter((value) => config.invalid.includes(value));
            if (intersection.length > 0) {
                throw new ValidationFailError(
                    `'${fieldName}.valid' y '${fieldName}.invalid' no pueden tener valores en común: [${intersection.join(', ')}]`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('min') && config.hasOwnProperty('max')) {
            if (config.min > config.max) {
                throw new ValidationFailError(
                    `'${fieldName}.min' (${config.min}) no puede ser mayor que '${fieldName}.max' (${config.max}).`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('greater') && config.hasOwnProperty('less')) {
            if (config.greater >= config.less) {
                throw new ValidationFailError(
                    `'${fieldName}.greater' (${config.greater}) no puede ser mayor o igual que '${fieldName}.less' (${config.less}).`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('min') && config.hasOwnProperty('greater')) {
            throw new ValidationFailError(
                `'${fieldName}' no puede tener 'min' y 'greater' definidos a la vez. Usa solo uno.`,
                fieldName
            );
        }

        if (config.hasOwnProperty('max') && config.hasOwnProperty('less')) {
            throw new ValidationFailError(
                `'${fieldName}' no puede tener 'max' y 'less' definidos a la vez. Usa solo uno.`,
                fieldName
            );
        }

        if (config.hasOwnProperty('multiple') && config.multiple === 0) {
            throw new ValidationFailError(`'${fieldName}.multiple' no puede ser 0.`, fieldName);
        }

        if (
            config.hasOwnProperty('integer') &&
            config.hasOwnProperty('precision') &&
            config.integer === true &&
            config.precision !== 0
        ) {
            throw new ValidationFailError(
                `'${fieldName}' no puede tener 'integer' y 'precision' definidos a la vez. Usa solo uno.`,
                fieldName
            );
        }

        if (config.hasOwnProperty('default')) {
            const def = config.default;

            if (config.integer === true && !Number.isInteger(def)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe ser un entero porque 'integer' es true.`,
                    fieldName
                );
            }

            if (Array.isArray(config.invalid) && config.invalid.includes(def)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' no puede estar en la lista de valores inválidos.`,
                    fieldName
                );
            }

            if (Array.isArray(config.valid) && !config.valid.includes(def)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe estar en la lista de valores válidos.`,
                    fieldName
                );
            }

            if (config.hasOwnProperty('positive') && config.hasOwnProperty('negative')) {
                if (config.positive !== config.negative) {
                    if (config.positive === true && !(def >= 0)) {
                        throw new ValidationFailError(`'${fieldName}.default' debe ser positivo.`, fieldName);
                    }
                    if (config.negative === true && !(def < 0)) {
                        throw new ValidationFailError(`'${fieldName}.default' debe ser negativo.`, fieldName);
                    }
                }
            } else if (config.positive === true && !(def >= 0)) {
                throw new ValidationFailError(`'${fieldName}.default' debe ser positivo.`, fieldName);
            } else if (config.negative === true && !(def < 0)) {
                throw new ValidationFailError(`'${fieldName}.default' debe ser negativo.`, fieldName);
            }

            if (config.hasOwnProperty('min') && def < config.min) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe ser mayor o igual a ${config.min}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('max') && def > config.max) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe ser menor o igual a ${config.max}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('greater') && def <= config.greater) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe ser mayor que ${config.greater}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('less') && def >= config.less) {
                throw new ValidationFailError(`'${fieldName}.default' debe ser menor que ${config.less}.`, fieldName);
            }

            if (config.hasOwnProperty('multiple') && def % config.multiple !== 0) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe ser múltiplo de ${config.multiple}.`,
                    fieldName
                );
            }

            if (config.port === true && (def < 0 || def > 65535)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe estar entre 0 y 65535 porque 'port' es true.`,
                    fieldName
                );
            }

            if (config.unsafe === false && (def < Number.MIN_SAFE_INTEGER || def > Number.MAX_SAFE_INTEGER)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe estar en el rango seguro de JavaScript.`,
                    fieldName
                );
            }

            if (config.hasOwnProperty('precision')) {
                const decimals = (def.toString().split('.')[1] || '').length;
                if (decimals !== config.precision) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe tener exactamente ${config.precision} decimales.`,
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
                `[NumberTypeValidator] '${fieldName}' contains unsupported key(s): ${keys.join(', ')}.`,
                keys[0]
            );
        }
    }
}
