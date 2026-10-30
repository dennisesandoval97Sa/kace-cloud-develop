import { InvalidArgumentError } from '../../errors/InvalidArgumentError';
import { Guards } from '../guards/Guards';
import { Helper } from '../../infrastructure/utils/Helper';

export class ValueObjectEnum {
    /** @type {String} is initialized in the constructor */
    #value = null;

    /**
     *
     * @param {String} field nombre campo que se está validando
     * @param {String} value valor a validar
     * @param {Array} validValues valores permitidos
     * @param {Boolean} nullable indica si el valor puede ser nulo
     *
     * @throws {InvalidArgumentError} si el valor no es válido
     */
    constructor(field, value, validValues, nullable = false) {
        this.field = field;
        if (!nullable && !value) {
            Helper.logError(`${this.field}: The value cannot be null`);
            throw new InvalidArgumentError(`${this.field}: The value cannot be null`);
        }
        if (nullable && !value) {
            return;
        }
        Guards.enumValue(value, validValues);
        this.#value = value;
        Object.freeze(this);
    }

    get value() {
        return this.#value;
    }

    equals(otherValue) {
        return this.#value === otherValue;
    }
}
