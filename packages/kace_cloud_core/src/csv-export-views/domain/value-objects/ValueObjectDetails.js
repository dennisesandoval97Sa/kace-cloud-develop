import { ValidationFailError, ValueObjectJson } from '../../../shared';
import { ValueObjectCsvFormatting } from './ValueObjectCsvFormatting';

export class ValueObjectDetails extends ValueObjectJson {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (value) {
            this.#validateStructure();
        }
    }

    #validateStructure() {
        const json = this.value;

        json.formatting = new ValueObjectCsvFormatting(json.formatting).value;

        if (json.errors) {
            if (!Array.isArray(json.errors)) {
                throw new ValidationFailError(`${this.field}.errors must be an array if present`, this.field);
            }
        }
    }
}
