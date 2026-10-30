import { Properties } from '../Properties';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError';
import { Helper } from '../../../shared';

export class ValueObjectPropertiesInstance {
    /**
     * @type {Properties}
     * is initialized in the constructor
     */
    #properties;
    constructor(properties) {
        this.#ensurePropertiesIsValid(properties);
        this.#properties = properties;
    }

    get value() {
        return this.#properties.value;
    }

    #ensurePropertiesIsValid(properties) {
        if (!(properties instanceof Properties)) {
            Helper.logError(`Invalid instance for properties`);
            throw new InvalidArgumentError('Invalid instance for properties');
        }
    }
}
