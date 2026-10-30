import { Guards, ValueObject } from '../../../shared';
import { validate as isValidUUID } from 'uuid';

export class ValueObjectPermissions extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.objectType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        const { blackList, whiteList } = this.value;

        if (typeof blackList !== 'object' || typeof whiteList !== 'object') {
            throw new Error(`${this.field}: blackList and whiteList must be objects`);
        }

        if (!Array.isArray(blackList.grupos) || !Array.isArray(blackList.usuarios)) {
            throw new Error(`${this.field}: blackList.grupos and blackList.usuarios must be arrays`);
        }

        if (!Array.isArray(whiteList.usuarios)) {
            throw new Error(`${this.field}: whiteList.usuarios must be an array`);
        }

        this.#ensureValidUUIDArray(blackList.grupos, 'blackList.grupos');
        this.#ensureValidUUIDArray(blackList.usuarios, 'blackList.usuarios');
        this.#ensureValidUUIDArray(whiteList.usuarios, 'whiteList.usuarios');
    }

    #ensureValidUUIDArray(array, fieldName) {
        array.forEach((item) => {
            if (!isValidUUID(item)) {
                throw new Error(`${fieldName}: ${item} is not a valid UUID`);
            }
        });
    }
}
