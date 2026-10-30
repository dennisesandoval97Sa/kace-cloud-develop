import { Guards } from '../../../shared';
import { ValueObject } from '../../../shared/domain/value-object/ValueObject';

export class ValueObjectFolders extends ValueObject {
    constructor(value, nullable = false) {
        super('folders', value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.arrayType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        if (!this.value.every((folder) => typeof folder === 'string' && folder.length <= 255)) {
            throw new Error(`${this.field}: All folders must be strings with a maximum length of 255 characters`);
        }
    }
}
