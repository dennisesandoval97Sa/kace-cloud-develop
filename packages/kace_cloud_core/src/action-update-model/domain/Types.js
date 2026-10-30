import { Helper } from '../../shared';

export class Types {
    static ALFANUMERICO = new Types('Alfanumérico', 'alfanumerico');
    static NUMERO = new Types('Número', 'numero');
    static FORMULA = new Types('Formula', 'formula');

    /** @type {string}
     * is initialized in the constructor
     */
    key;

    /** @type {string}
     * is initialized in the constructor
     */
    value;

    constructor(key, value) {
        this.#ensureIsValidType(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            alfanumerico: Types.ALFANUMERICO,
            numero: Types.NUMERO,
            formula: Types.FORMULA,
        };

        if (!map[value]) {
            Helper.logError(`Invalid value: ${value}`);
            throw new Error('Invalid type');
        }
        return map[value];
    }

    #ensureIsValidType(value) {
        const validValues = new Set(['alfanumerico', 'numero', 'formula']);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(Types)) {
            if (Types[key] instanceof Types) {
                json[key] = Types[key].value;
            }
        }
        return json;
    }
}
