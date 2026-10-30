import { Guards, ValueObjectString } from "@kace/core/src/shared";

export class ValueObjectIcon extends ValueObjectString {
    constructor(field, value, isNull) {
        super(field, value, isNull);

        Guards.stringMaxLength(this, 1000);
        Guards.stringMinLength(this, 1);
    }
}
