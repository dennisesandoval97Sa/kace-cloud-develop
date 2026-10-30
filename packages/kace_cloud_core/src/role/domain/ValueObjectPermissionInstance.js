import { Permissions } from './Permissions';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';

export class ValueObjectPermissionInstance {
    /** @type {String} is initialized in the constructor */
    #value;
    constructor(value) {
        this.#ensureValueIsValid(value);
        this.#value = value.toPrimitives();
    }

    #ensureValueIsValid(value) {
        if (value instanceof Permissions == false) {
            throw new InvalidArgumentError('Invalid instance for permissions');
        }
    }

    get value() {
        return this.#value;
    }
}
