import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';

export class ValueObjectCertificate extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
    }
}
