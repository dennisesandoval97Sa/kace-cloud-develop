export class FieldValidationRule {
    constructor(fieldName, { isRequired = false, minLength = null, maxLength = null }) {
        this.fieldName = fieldName;
        this.isRequired = isRequired;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }

    validate(value, errorCollector) {
        if (this.isRequired && this.#isEmpty(value)) {
            errorCollector.addError(this.fieldName, `"${this.fieldName}" is required`);
            return;
        }

        if (!this.#isEmpty(value) && typeof value === 'string') {
            this.#validateLength(value, errorCollector);
        }
    }

    #validateLength(value, errorCollector) {
        if (this.minLength && value.length < this.minLength) {
            errorCollector.addError(
                this.fieldName,
                `"${this.fieldName}" length must be at least ${this.minLength} characters long`
            );
        }

        if (this.maxLength && value.length > this.maxLength) {
            errorCollector.addError(
                this.fieldName,
                `"${this.fieldName}" length must be less than or equal to ${this.maxLength} characters long`
            );
        }
    }

    #isEmpty(value) {
        return value === undefined || value === null || value === '';
    }
}
