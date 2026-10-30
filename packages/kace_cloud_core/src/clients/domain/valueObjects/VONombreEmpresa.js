import { Guards, ValidationFailError, ValueObjectString } from '../../../shared/index.js';

export class VONombreEmpresa extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new ValidationFailError(`${this.field}: The value cannot be null`, this.field);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringMaxLength(this, 100);
            Guards.stringMinLength(this, 3);
            Guards.stringPattern(
                this,
                /^[a-zA-ZÀ-ÿ0-9\s&.,\-/\\|();+~]*$/,
                `${this.field}: The name must contain only letters, numbers and some symbols:  ${value}`
            );
        }
    }
}
