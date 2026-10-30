import { ActionTriggers, Guards, ValueObject } from '../../../shared';

export class ValueObjectTriggers extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.arrayType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        this.value.forEach((triggers) => {
            ActionTriggers.fromValue(triggers);
        });
    }
}
