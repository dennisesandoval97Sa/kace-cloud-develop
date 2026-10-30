import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';
import { Helper } from '../../shared';

export class PositionTypes {
    static TOP_LEFT = new PositionTypes('TOP_LEFT', 'top-left');
    static TOP_CENTER = new PositionTypes('TOP_CENTER', 'top-center');
    static TOP_RIGHT = new PositionTypes('TOP_RIGHT', 'top-right');
    static BOTTOM_LEFT = new PositionTypes('BOTTOM_LEFT', 'bottom-left');
    static BOTTOM_CENTER = new PositionTypes('BOTTOM_CENTER', 'bottom-center');
    static BOTTOM_RIGHT = new PositionTypes('BOTTOM_RIGHT', 'bottom-right');

    constructor(name, value) {
        this.#ensureIsValidPosition(value);

        this.name = name;
        this.value = value;
        Object.freeze(this);
    }

    static fromValue(value) {
        for (const key in PositionTypes) {
            if (PositionTypes[key].value === value) {
                return PositionTypes[key];
            }
        }
        throw new InvalidArgumentError(`Invalid position value: ${value}`);
    }

    static getValidValues() {
        return ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    }

    #ensureIsValidPosition(value) {
        const validValues = PositionTypes.getValidValues();
        if (!value) {
            Helper.logError(`The position value cannot be null`);
            throw new InvalidArgumentError('The position value cannot be null');
        }
        if (!validValues.includes(value)) {
            Helper.logError(`The position value must be a valid position: ${value}`);
            throw new InvalidArgumentError(`The position value must be a valid position: ${value}`);
        }
    }
}
