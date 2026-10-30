import { ValueObjectJson } from '../../shared';
import { InvalidArgumentError } from '../../shared/index.js';

export class ValueObjectUserFilters extends ValueObjectJson {
    constructor(field, value = null, nullable = false) {
        super(field, value, nullable);
        if (!value && nullable) {
            return;
        }
        this.#ensureIsValid(value);
    }

    #ensureIsValid(value) {
        const application = value.application;
        if (!application || (!('admin' in application) && !('agent' in application))) {
            throw new InvalidArgumentError(`${this.field}: The structure must include admin or agent objects`);
        }
    }
}
