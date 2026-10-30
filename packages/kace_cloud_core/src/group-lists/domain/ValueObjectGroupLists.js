import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';
import { Helper, ValueObjectJson, ValueObjectUuid } from '../../shared/index.js';

export class ValueObjectGroupLists extends ValueObjectJson {
    constructor(field, value) {
        super(field, value);
        this.#ensureIsValid(value);
    }

    #ensureIsValid(value) {
        if (!Array.isArray(value) || !value.every((g) => g.id)) {
            Helper.logError('Invalid groups list');
            throw new InvalidArgumentError('Invalid groups list');
        }

        value.forEach((item) => new ValueObjectUuid('idGroup', item.id));
    }
}
