import { SiteRole } from '../../index';

export class ValueObjectSiteRole {
    /**
     * @type {Types}
     * is initialized in the constructor
     */
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        this.#value = SiteRole.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value?.value;
    }
}
