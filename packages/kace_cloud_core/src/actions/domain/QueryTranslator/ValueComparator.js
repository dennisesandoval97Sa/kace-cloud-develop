import { InvalidArgumentError } from '../../../shared';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import createDayjsInstance from '../../../shared/factories/DayjsFactory';

const dayjs = createDayjsInstance({
    plugins: [customParseFormat],
});

export class ValueComparator {
    static compareEquals(fieldValue, ruleValue, valueType) {
        if (valueType === 'date') {
            return fieldValue.isSame(ruleValue);
        }
        return fieldValue === ruleValue;
    }

    static compareLessThan(fieldValue, ruleValue, valueType) {
        if (valueType === 'date') {
            return fieldValue.isBefore(ruleValue);
        }
        return fieldValue < ruleValue;
    }

    static compareGreaterThan(fieldValue, ruleValue, valueType) {
        if (valueType === 'date') {
            return fieldValue.isAfter(ruleValue);
        }
        return fieldValue > ruleValue;
    }

    static compareLessThanOrEqual(fieldValue, ruleValue, valueType) {
        if (valueType === 'date') {
            return fieldValue.isSameOrBefore(ruleValue);
        }
        return fieldValue <= ruleValue;
    }

    static compareGreaterThanOrEqual(fieldValue, ruleValue, valueType) {
        if (valueType === 'date') {
            return fieldValue.isSameOrAfter(ruleValue);
        }
        return fieldValue >= ruleValue;
    }

    static compareContains(fieldValue, ruleValue) {
        return String(fieldValue).includes(String(ruleValue));
    }

    static compareBeginsWith(fieldValue, ruleValue) {
        return String(fieldValue).startsWith(String(ruleValue));
    }

    static compareEndsWith(fieldValue, ruleValue) {
        return String(fieldValue).endsWith(String(ruleValue));
    }

    static compareIn(fieldValue, ruleValue, valueType) {
        const values = String(ruleValue)
            .split(',')
            .map((v) => v.trim());

        if (valueType === 'date') {
            return values.some((val) => {
                const parsedVal = this.#parseDate(val);
                return parsedVal !== null && fieldValue.isSame(parsedVal);
            });
        }

        if (valueType === 'number') {
            return values.some((val) => {
                const parsedVal = this.#parseNumber(val);
                return parsedVal !== null && fieldValue === parsedVal;
            });
        }

        return values.includes(String(fieldValue));
    }

    static compareBetween(fieldValue, ruleValue, valueType) {
        const values = String(ruleValue)
            .split(',')
            .map((v) => v.trim());

        if (values.length !== 2) {
            throw new InvalidArgumentError('BETWEEN operator requires exactly 2 values separated by comma');
        }

        if (valueType === 'date') {
            const startDate = this.#parseDate(values[0]);
            const endDate = this.#parseDate(values[1]);

            if (startDate === null || endDate === null) {
                return false;
            }

            return fieldValue.isSameOrAfter(startDate) && fieldValue.isSameOrBefore(endDate);
        }

        if (valueType === 'number') {
            const startNum = this.#parseNumber(values[0]);
            const endNum = this.#parseNumber(values[1]);

            if (startNum === null || endNum === null) {
                return false;
            }
            return fieldValue >= startNum && fieldValue <= endNum;
        }

        return String(fieldValue) >= values[0] && String(fieldValue) <= values[1];
    }

    /**
     * Process a single value according to its type
     * @param {*} value - The value to process
     * @param {string} valueType - The type of the value ('date', 'number', 'text')
     * @returns {*} - The processed value
     * @throws {Error} If valueType is unsupported
     */
    static processValue(value, valueType = 'text') {
        const processors = {
            date: (v) => this.#parseDate(v),
            number: (v) => this.#parseNumber(v),
            text: (v) => String(v),
        };

        const process = processors[valueType];

        if (!process) {
            throw new Error(
                `Unsupported valueType: '${valueType}'. Supported types are: ${Object.keys(processors).join(', ')}`
            );
        }

        return process(value);
    }

    /**
     * Parse a value as a date using dayjs
     * @param {*} value
     * @returns {dayjs.Dayjs}
     */
    static #parseDate(value) {
        if (!value) {
            return null;
        }

        if (dayjs.isDayjs(value)) {
            return value;
        }

        // Los formatos explícitos van primero y en modo estricto: el parser nativo
        // resuelve "11/08/2026" como MM/DD (convención US) y sin `strict` el primer
        // formato de la lista acepta cualquier cadena rellenando lo que no encaja.
        if (typeof value === 'string') {
            const commonFormats = [
                'YYYY-MM-DD HH:mm:ss',
                'DD/MM/YYYY HH:mm:ss',
                'MM/DD/YYYY HH:mm:ss',
                'YYYY-MM-DD',
                'DD/MM/YYYY',
                'MM/DD/YYYY',
                'HH:mm:ss',
                'HH:mm',
            ];

            for (const format of commonFormats) {
                const parsed = dayjs(value, format, true);
                if (parsed.isValid()) {
                    return parsed;
                }
            }
        }

        const parsedDate = dayjs(value);

        if (!parsedDate.isValid()) {
            return null;
        }

        return parsedDate;
    }

    /**
     * Parse a value as a number
     * @param {*} value
     * @returns {number}
     */
    static #parseNumber(value) {
        const numValue = Number(value);
        if (isNaN(numValue)) return null;
        return numValue;
    }
}
