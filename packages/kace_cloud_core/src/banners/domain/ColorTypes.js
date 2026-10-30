import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError';

export class ColorTypes {
    static WHITE = new ColorTypes('WHITE', '#FFFFFF');
    static BLACK = new ColorTypes('BLACK', '#000000');
    static RED = new ColorTypes('RED', '#FF0000');
    static BLUE = new ColorTypes('BLUE', '#0000FF');
    static GREEN = new ColorTypes('GREEN', '#00FF00');
    static YELLOW = new ColorTypes('YELLOW', '#FFFF00');
    static ORANGE = new ColorTypes('ORANGE', '#FFA500');
    static PURPLE = new ColorTypes('PURPLE', '#800080');
    static GRAY = new ColorTypes('GRAY', '#808080');
    static PINK = new ColorTypes('PINK', '#FFC0CB');

    constructor(name, value) {
        this.#ensureIsValidColor(value);

        this.name = name;
        this.value = value;
        Object.freeze(this);
    }

    static fromValue(value) {
        for (const key in ColorTypes) {
            if (ColorTypes[key].value === value) {
                return ColorTypes[key];
            }
        }
        throw new InvalidArgumentError(`Invalid color value: ${value}`);
    }

    static getValidValues() {
        return [
            '#FFFFFF',
            '#000000',
            '#FF0000',
            '#0000FF',
            '#00FF00',
            '#FFFF00',
            '#FFA500',
            '#800080',
            '#808080',
            '#FFC0CB',
        ];
    }

    #ensureIsValidColor(value) {
        const validValues = ColorTypes.getValidValues();
        if (!value) {
            throw new Error('The color value cannot be null');
        }
        if (!validValues.includes(value)) {
            throw new Error(`The color value must be a valid color: ${value}`);
        }
    }
}
