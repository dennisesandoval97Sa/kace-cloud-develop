import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';
import { Helper, ValueObjectJson, ValueObjectUuid } from '../../shared/index.js';

export class ValueObjectUserLists extends ValueObjectJson {
    constructor(field, value) {
        super(field, value);
        this.#ensureIsValid(value);
    }

    #ensureIsValid(value) {
        if (!Array.isArray(value) || !value.every((g) => g.id)) {
            Helper.logError('Invalid user lists');
            throw new InvalidArgumentError('Invalid user lists');
        }

        value.forEach((item) => new ValueObjectUuid('idUser', item.id));
    }
}
