import { Helper } from '../../infrastructure/utils/Helper';

export class StatusEnum {
    static ACTIVE = new StatusEnum('ACTIVE', 1);
    static INACTIVE = new StatusEnum('INACTIVE', 2);

    constructor(key, value) {
        this.#ensureIsValidStatus(value);

        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidStatus(value) {
        if (!value) {
            Helper.logError(`Invalid value: ${value}`);
            throw new Error(`Invalid value: ${value}`);
        }
        if (value !== 1 && value !== 2) {
            Helper.logError(`The value must be a valid status: ${value}`);
            throw new Error(`The value must be a valid status: ${value}`);
        }
    }

    static fromValue(value) {
        if (value === 1) return StatusEnum.ACTIVE;
        if (value === 2) return StatusEnum.INACTIVE;
        Helper.logError(`Invalid value: ${value}`);
        throw new Error(`Invalid value: ${value}`);
    }

    static toJson() {
        return {
            ACTIVE: StatusEnum.ACTIVE.value,
            INACTIVE: StatusEnum.INACTIVE.value,
        };
    }
}
