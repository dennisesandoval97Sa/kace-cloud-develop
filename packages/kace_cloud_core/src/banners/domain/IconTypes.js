import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';

export class IconTypes {
    static CHECK = new IconTypes('CHECK', 'check');
    static EXCLAMATION_CIRCLE = new IconTypes('EXCLAMATION_CIRCLE', 'exclamation-circle');
    static EXCLAMATION_TRIANGLE = new IconTypes('EXCLAMATION_TRIANGLE', 'exclamation-triangle');

    constructor(key, value) {
        this.#ensureIsValidIcon(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        for (const key in IconTypes) {
            if (IconTypes[key].value === value) {
                return IconTypes[key];
            }
        }
        throw new InvalidArgumentError(`Invalid icon value: ${value}`);
    }

    static getValidValues() {
        return ['check', 'exclamation-circle', 'exclamation-triangle'];
    }

    #ensureIsValidIcon(value) {
        const validValues = IconTypes.getValidValues();
        if (!value) {
            throw new InvalidArgumentError('The value cannot be null');
        }
        if (!validValues.includes(value)) {
            throw new InvalidArgumentError(`The value must be a valid Icon: ${value}`);
        }
    }
}
