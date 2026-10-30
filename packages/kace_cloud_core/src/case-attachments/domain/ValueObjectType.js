import { CaseAttachmentTypeEnum, Guards, ValueObject } from '../../shared/index';

export class ValueObjectType extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, +value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.integerType(this);

        CaseAttachmentTypeEnum.fromValue(value);
    }
}
