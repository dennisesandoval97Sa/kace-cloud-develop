import { Guards, Helper } from '../../shared';
import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';
import { ActionsEnum } from './ActionsEnum';

export class ValueObjectActions {
    /** @type {Array} is initialized in the constructor */
    #value;
    constructor(field, value, nullable = false) {
        if (nullable && value === null) {
            return;
        }

        if (!nullable && value === null) {
            throw new InvalidArgumentError(`Invalid value for ${field}`);
        }

        this.#value = value;
        Guards.arrayType(this);

        for (const valueEnum of value) {
            if (!Object.values(ActionsEnum.toJson()).includes(valueEnum)) {
                Helper.logError(`Invalid value for ${field}`);
                throw new InvalidArgumentError(`Invalid value for ${field}`);
            }
        }
    }

    get value() {
        return this.#value;
    }
}
