import { Specifications } from '../Specifications';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../../shared';

export class ValueObjectSpecificationsInstance {
    /**
     * @type {Specifications}
     * is initialized in the constructor
     */
    #value;

    constructor(value) {
        this.#ensureValueIsValid(value);
        this.#value = value;
    }

    get value() {
        return this.#value.value;
    }

    #ensureValueIsValid(value) {
        if (!(value instanceof Specifications)) {
            Helper.logError(`Invalid instance for specification`);
            throw new InvalidArgumentError('Invalid instance for specification');
        }
    }
}
