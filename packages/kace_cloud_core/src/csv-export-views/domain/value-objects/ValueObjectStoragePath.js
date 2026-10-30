import { Guards } from '../../../shared/domain/guards/Guards.js';
import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectStoragePath extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.stringMaxLength(this, 1024);
        this.#ensureValidPath();
    }

    #ensureValidPath() {
        const pathRegex = /^([\w-]+)+(\/[\w-.]+)*$/;
        if (!pathRegex.test(this.value)) {
            throw new Error(`${this.field}: Invalid file path format`);
        }
    }
}
