import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';
import { TEMPLATE_INVALID_TYPE } from '@kace/error-codes';
import { Helper } from '../../shared';

export class Types {
    static EMAIL = new Types('EMAIL', 1);
    static SMS = new Types('SMS', 2);

    constructor(key, value) {
        this.#ensureIsValidTypes(value);
        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    static fromValue(value) {
        for (const key in Types) {
            if (Types[key].value === value) {
                return Types[key];
            }
        }
        Helper.logError(`Invalid type value: ${value}`);
        throw new InvalidArgumentError(`Invalid type value: ${value}`, 400, TEMPLATE_INVALID_TYPE);
    }

    static getValidValues() {
        return [1, 2];
    }

    #ensureIsValidTypes(value) {
        const validValues = Types.getValidValues();
        if (!value) {
            Helper.logError('The value cannot be null');
            throw new InvalidArgumentError('The value cannot be null', 400, TEMPLATE_INVALID_TYPE);
        }
        if (!validValues.includes(value)) {
            Helper.logError(`The value must be a valid Type: ${value}`);
            throw new InvalidArgumentError(`The value must be a valid Type: ${value}`, 400, TEMPLATE_INVALID_TYPE);
        }
    }
}
