import { Guards, ValueObjectString, ValidationFailError } from '../../../shared';

export class ValueObjectEntity extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new ValidationFailError(`${this.field}: The value cannot be null`, this.field);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 255);
            Guards.stringMinLength(this, 3);

            if (!this.#validEntities.includes(value)) {
                throw new ValidationFailError(`${value} isn't a valid entity`, "entity");
            }
        }

    }

    #validEntities = [
        "case",
        "group",
        "user",
    ]
}
