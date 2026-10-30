import { ValidationFailError, ValueObjectJson } from '../../../shared';

export class ValueObjectCsvFormatting extends ValueObjectJson {
    static DEFAULT_VALUES = {
        separator: ',',
        valueQuotes: true,
        headerQuotes: true,
        includeHeader: true,
        encoding: 'utf-8',
        lineTerminator: '\n',
        nullValue: '',
    };

    constructor(value) {
        const formattedValue = ValueObjectCsvFormatting.#applyDefaults(value);
        super('formatting', formattedValue, true);

        this.#validateStructure();
    }

    static #applyDefaults(value) {
        const defaultValues = ValueObjectCsvFormatting.DEFAULT_VALUES;
        const filteredValue = {};

        if (!value || typeof value !== 'object') {
            return { ...defaultValues };
        }

        Object.keys(defaultValues).forEach((key) => {
            if (value.hasOwnProperty(key)) {
                filteredValue[key] = value[key];
            }
        });

        return {
            ...defaultValues,
            ...filteredValue,
        };
    }

    #validateStructure() {
        const formatting = this.value;

        if (typeof formatting.separator !== 'string' || formatting.separator.length !== 1) {
            throw new ValidationFailError(
                `"${this.field}.separator" must be a string with exactly one character.`,
                this.field
            );
        }

        if (typeof formatting.valueQuotes !== 'boolean') {
            throw new ValidationFailError(`"${this.field}.valueQuotes" must be a boolean`, this.field);
        }

        if (typeof formatting.headerQuotes !== 'boolean') {
            throw new ValidationFailError(`"${this.field}.headerQuotes" must be a boolean`, this.field);
        }

        if (typeof formatting.includeHeader !== 'boolean') {
            throw new ValidationFailError(`"${this.field}.includeHeader" must be a boolean`, this.field);
        }

        if (!['utf-8', 'utf8', 'latin1', 'ascii'].includes(formatting.encoding)) {
            throw new ValidationFailError(
                `"${this.field}.encoding" must be one of ['utf-8', 'latin1', 'ascii']`,
                this.field
            );
        }

        if (!['\n', '\r\n'].includes(formatting.lineTerminator)) {
            throw new ValidationFailError(`"${this.field}.lineTerminator" must be either ['\n', '\r\n']`, this.field);
        }

        if (typeof formatting.nullValue !== 'string') {
            throw new ValidationFailError(`"${this.field}.nullValue" must be a string`, this.field);
        }
    }
}
