import { Helper, ValidationFailError, ValueObjectUuid, TenantContext } from '../../../shared/index.js';
import { VALID_INPUT_TYPES } from '../../constants/constantsIU.js';
import { AllowedAttributes } from './AllowedAttributes.js';

export class DateTypeValidator {
    validate(fieldName, config) {
        const tenant = TenantContext.getTenant();
        const allowed = [
            ...AllowedAttributes,
            'empty',
            'iso',
            'timestamp',
            'min',
            'max',
            'greater',
            'less',
            'default',
            'restflow_id',
            'timezone',
            'timezoneFormat',
        ];

        this.rejectUnexpectedKeys(config, allowed, fieldName);

        // Apply defaults
        if (!config.hasOwnProperty('timezoneFormat') || config.timezoneFormat === undefined) {
            config.timezoneFormat = 'withoutTimezone';
        }

        if (
            config.timezoneFormat === 'withoutTimezone' &&
            (!config.hasOwnProperty('timezone') || config.timezone === null || config.timezone === undefined)
        ) {
            if (!tenant || !tenant.timezone) {
                throw new ValidationFailError(
                    `'${fieldName}.timezone' es obligatorio cuando 'timezoneFormat' es 'withoutTimezone'. ` +
                        `Variable de entorno TIMEZONE no está definida.`,
                    fieldName
                );
            }
            config.timezone = tenant.timezone.value;
        }

        // Validate timezoneFormat
        if (config.hasOwnProperty('timezoneFormat')) {
            if (typeof config.timezoneFormat !== 'string') {
                throw new ValidationFailError(`'${fieldName}.timezoneFormat' must be a string.`, fieldName);
            }

            if (!['withTimezone', 'withoutTimezone'].includes(config.timezoneFormat)) {
                throw new ValidationFailError(
                    `'${fieldName}.timezoneFormat' debe ser 'withTimezone' o 'withoutTimezone'. Recibido: '${config.timezoneFormat}'.`,
                    fieldName
                );
            }
        }

        // Validate timezone (IANA)
        if (config.hasOwnProperty('timezone') && config.timezone !== null && config.timezone !== undefined) {
            if (typeof config.timezone !== 'string') {
                throw new ValidationFailError(`'${fieldName}.timezone' must be a string.`, fieldName);
            }

            try {
                Intl.DateTimeFormat(undefined, { timeZone: config.timezone });
            } catch {
                throw new ValidationFailError(
                    `'${fieldName}.timezone' debe ser una zona horaria IANA válida (ej: 'America/Bogota', 'UTC'). Recibido: '${config.timezone}'.`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('iso') && typeof config.iso !== 'boolean') {
            throw new ValidationFailError(`'${fieldName}.iso' must be a boolean.`, fieldName);
        }

        if (config.hasOwnProperty('empty') && typeof config.empty !== 'boolean') {
            throw new ValidationFailError(`'${fieldName}.empty' must be a boolean.`, fieldName);
        }

        if (config.hasOwnProperty('timestamp') && !['unix', 'javascript'].includes(config.timestamp)) {
            throw new ValidationFailError(`'${fieldName}.timestamp' must be either 'unix' or 'javascript'.`, fieldName);
        }

        if (config.hasOwnProperty('iso') && config.hasOwnProperty('timestamp') && config.iso) {
            throw new ValidationFailError(
                `'${fieldName}' no puede tener 'iso' y 'timestamp' definidos al mismo tiempo. Usa solo uno.`,
                fieldName
            );
        }

        ['min', 'max', 'greater', 'less', 'default'].forEach((key) => {
            if (config.hasOwnProperty(key) && typeof config[key] !== 'string') {
                throw new ValidationFailError(
                    `'${fieldName}.${key}' must be a string (date or keyword like 'now').`,
                    fieldName
                );
            }
        });

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

        const parseDate = (val) => {
            if (val === 'now') val = new Date();
            else {
                const d = new Date(val);
                if (isNaN(d.getTime())) {
                    throw new ValidationFailError(
                        `'${fieldName}' debe ser una fecha válida en formato ISO.`,
                        fieldName
                    );
                }
                val = d;
            }

            if (config.timestamp === 'unix') return Math.floor(val.getTime() / 1000);
            if (config.timestamp === 'javascript') return val.getTime();
            return val.toISOString();
        };

        ['min', 'max', 'greater', 'less'].forEach((key) => {
            if (config.hasOwnProperty(key)) {
                parseDate(config[key]);
            }
        });

        if (config.hasOwnProperty('min') && config.hasOwnProperty('max')) {
            const minDate = parseDate(config.min);
            const maxDate = parseDate(config.max);
            if (minDate > maxDate) {
                throw new ValidationFailError(
                    `'${fieldName}.min' (${config.min}) no puede ser posterior a '${fieldName}.max' (${config.max}).`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('greater') && config.hasOwnProperty('less')) {
            const greaterDate = parseDate(config.greater);
            const lessDate = parseDate(config.less);
            if (greaterDate >= lessDate) {
                throw new ValidationFailError(
                    `'${fieldName}.greater' (${config.greater}) no puede ser igual o posterior a '${fieldName}.less' (${config.less}).`,
                    fieldName
                );
            }
        }

        if (config.hasOwnProperty('default')) {
            let defDate;
            try {
                defDate = parseDate(config.default);
            } catch (e) {
                Helper.logError(`Error parsing date: `, e);
                throw new ValidationFailError(`'${fieldName}.default' debe ser una fecha válida o 'now'.`, fieldName);
            }

            if (config.hasOwnProperty('min')) {
                const minDate = parseDate(config.min);
                if (defDate < minDate) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe ser igual o posterior a '${fieldName}.min'.`,
                        fieldName
                    );
                }
            }
            if (config.hasOwnProperty('max')) {
                const maxDate = parseDate(config.max);
                if (defDate > maxDate) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe ser igual o anterior a '${fieldName}.max'.`,
                        fieldName
                    );
                }
            }
            if (config.hasOwnProperty('greater')) {
                const greaterDate = parseDate(config.greater);
                if (defDate <= greaterDate) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe ser posterior a '${fieldName}.greater'.`,
                        fieldName
                    );
                }
            }
            if (config.hasOwnProperty('less')) {
                const lessDate = parseDate(config.less);
                if (defDate >= lessDate) {
                    throw new ValidationFailError(
                        `'${fieldName}.default' debe ser anterior a '${fieldName}.less'.`,
                        fieldName
                    );
                }
            }
        }

        if (config.hasOwnProperty('restflow_id') && config.restflow_id) {
            // SONAR-EXC: Instancia para validar, no se almacena
            new ValueObjectUuid('restflow_id', config.restflow_id);
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
                `[DateTypeValidator] '${fieldName}' contains unsupported key(s): ${keys.join(', ')}.`,
                keys[0]
            );
        }
    }
}
