import { Guards, ValueObject } from '../../shared';

export class ValueObjectStringMaxLength extends ValueObject {
    // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
    // TODO: No utilizar genericos
    constructor(field, value, maxLength, nullable) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringType(this);
        Guards.stringMaxLength(this, maxLength);
    }
}
