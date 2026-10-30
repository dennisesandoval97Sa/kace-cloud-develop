import { ValidationFailError, ValueObjectString, ValueObjectUuid } from '../../../shared/index.js';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU.js';
import { AllowedAttributes } from './AllowedAttributes.js';

export class StringTypeValidator {
    validate(fieldName, config) {
        const allowed = [
            ...AllowedAttributes,
            'empty',
            'min',
            'max',
            'length',
            'alphanum',
            'ip',
            'email',
            'uri',
            'isoDate',
            'base64',
            'dataUri',
            'pattern',
            'regexReplace',
            'valid',
            'invalid',
            'trim',
            'lowercase',
            'uppercase',
            'default',
            'restflow_id',
        ];

        this.rejectUnexpectedKeys(config, allowed, fieldName);

        const booleanFields = [
            'required',
            'empty',
            'alphanum',
            'isoDate',
            'base64',
            'dataUri',
            'trim',
            'lowercase',
            'uppercase',
        ];
        booleanFields.forEach((field) => {
            if (config.hasOwnProperty(field) && typeof config[field] !== 'boolean') {
                throw new ValidationFailError(`'${fieldName}.${field}' is required and must be a boolean.`, fieldName);
            }
        });

        const numberFields = ['min', 'max', 'length'];
        numberFields.forEach((field) => {
            if (config.hasOwnProperty(field) && typeof config[field] !== 'number') {
                throw new ValidationFailError(`'${fieldName}.${field}' is required and must be a number.`, fieldName);
            }
        });

        const objectFields = ['ip', 'email', 'uri', 'pattern'];
        objectFields.forEach((field) => {
            if (config.hasOwnProperty(field) && typeof config[field] !== 'object') {
                throw new ValidationFailError(`'${fieldName}.${field}' is required and must be an object.`, fieldName);
            }
        });

        const arrayFields = ['regexReplace', 'valid', 'invalid'];
        arrayFields.forEach((field) => {
            if (config.hasOwnProperty(field) && !Array.isArray(config[field])) {
                throw new ValidationFailError(`'${fieldName}.${field}' is required and must be an array.`, fieldName);
            }
        });

        if (config.hasOwnProperty('default') && typeof config.default !== 'string') {
            throw new ValidationFailError(`'${fieldName}.default' is required and must be a string.`, fieldName);
        }

        // SONAR-EXC: Instancia para validar, no se almacena
        new ValueObjectString('string validator default', config.default, true);

        if (config.hasOwnProperty('restflow_id') && config.restflow_id) {
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectUuid('restflow_id', config.restflow_id);
        }

        if (config.hasOwnProperty('min') && config.hasOwnProperty('max')) {
            if (config.min > config.max) {
                throw new ValidationFailError(
                    `'${fieldName}.min' (${config.min}) no puede ser mayor que '${fieldName}.max' (${config.max}).`,
                    fieldName
                );
            }
        }
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        //TODO: si se envían los arreglos "valid" e "invalid" vacíos no se aplican validaciones
        if (Array.isArray(config.valid) && Array.isArray(config.invalid)) {
            const intersection = config.valid.filter((value) => config.invalid.includes(value));
            if (intersection.length > 0) {
                throw new ValidationFailError(
                    `'${fieldName}.valid' y '${fieldName}.invalid' no pueden tener valores en común: [${intersection.join(', ')}]`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('length') && (config.hasOwnProperty('min') || config.hasOwnProperty('max'))) {
            throw new ValidationFailError(
                `'${fieldName}' no puede tener 'length' junto con 'min' o 'max'. Usa solo uno de estos enfoques.`,
                fieldName
            );
        }

        if (config.hasOwnProperty('default')) {
            const def = config.default;
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            //TODO: si se envían los arreglos "valid" e "invalid" vacíos no se aplican validaciones
            if (Array.isArray(config.invalid) && config.invalid.includes(def)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' no puede estar en la lista de valores inválidos.`,
                    fieldName
                );
            }
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            //TODO: si se envían los arreglos "valid" e "invalid" vacíos no se aplican validaciones
            if (Array.isArray(config.valid) && !config.valid.includes(def)) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe estar en la lista de valores válidos.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('length') && def.length !== config.length) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe tener longitud exactamente ${config.length}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('min') && def.length < config.min) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe tener longitud mínima de ${config.min}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('max') && def.length > config.max) {
                throw new ValidationFailError(
                    `'${fieldName}.default' debe tener longitud máxima de ${config.max}.`,
                    fieldName
                );
            }
            if (config.hasOwnProperty('pattern') && config.pattern instanceof RegExp) {
                if (!config.pattern.test(def)) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' no cumple con el patrón especificado.`,
                        fieldName
                    );
                }
            }
            if (config.hasOwnProperty('alphanum') && config.alphanum === true) {
                if (!/^[a-zA-Z0-9]+$/.test(def)) {
                    throw new ValidationFailError(`'${fieldName}.default' debe ser alfanumérico.`, fieldName);
                }
            }
            if (config.hasOwnProperty('lowercase') && config.lowercase === true) {
                if (def !== def.toLowerCase()) {
                    throw new ValidationFailError(`'${fieldName}.default' debe estar en minúsculas.`, fieldName);
                }
            }
            if (config.hasOwnProperty('uppercase') && config.uppercase === true) {
                if (def !== def.toUpperCase()) {
                    throw new ValidationFailError(`'${fieldName}.default' debe estar en mayúsculas.`, fieldName);
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
                `[StringTypeValidator] '${fieldName}' contains unsupported key(s): ${keys.join(', ')}.`,
                keys[0]
            );
        }
    }
}
