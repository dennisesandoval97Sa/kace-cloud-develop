import { Guards, ValueObject } from '../../shared/index.js';

export class ValueObjectCognitoData extends ValueObject {
    constructor(value, nullable = false) {
        super('cognito_hash_data', value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
        }
    }
}
