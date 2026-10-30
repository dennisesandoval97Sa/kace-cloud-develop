import { Guards, ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIncludeAttachments extends ValueObjectBoolean {
    constructor(field, value, nullable) {
        const booleanValue = typeof value === 'number' ? Boolean(value) : value;
        super(field, booleanValue, nullable);
        this.#ensureIsValidValue();
    }

    #ensureIsValidValue() {
        Guards.booleanType(this);
    }
}
