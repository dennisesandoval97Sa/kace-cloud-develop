import { Guards, ValueObject } from '../../../shared/index.js';

export class ValueObjectUrlApi extends ValueObject {
    constructor(value, nullable = false) {
        super('url_api', value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.stringType(this);
        Guards.stringMaxLength(this, 1000);
    }
}
