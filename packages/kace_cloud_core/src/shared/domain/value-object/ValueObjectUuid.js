import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { UuidError } from '../../errors/UuidError';
import { ValueObject } from './ValueObject';
import { Helper } from '../../infrastructure/utils/Helper';

export class ValueObjectUuid extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value) {
            if (!nullable) {
                Helper.logError(`${this.field}: The value cannot be null`);
                throw new Error(`${this.field}: The value cannot be null`);
            }
        } else {
            this.#ensureValueObjectUuid(value);
        }
    }

    static random() {
        return uuidv4();
    }

    /**
     * Checks if a string is a valid UUID without throwing exceptions
     * @param {string} value - Value to check
     * @returns {boolean} True if valid, false otherwise
     */
    static isValidUuid(value) {
        return uuidValidate(value);
    }

    #ensureValueObjectUuid(value) {
        if (!ValueObjectUuid.isValidUuid(value)) {
            Helper.logError(`${this.field}: Invalid value ${value} for object uuid`);
            throw new UuidError(`${this.field}: Invalid value ${value} for object uuid`);
        }
    }

    /**
     *
     * @param {ValueObjectUuid} vo
     * @returns {boolean}
     */
    isEqual(vo) {
        return this.value === vo.value;
    }
}
