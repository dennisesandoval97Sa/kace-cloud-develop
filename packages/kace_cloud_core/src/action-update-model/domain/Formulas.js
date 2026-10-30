export class Formulas {
    static FECHA_ACTUAL = new Formulas('FECHA_ACTUAL', 'fecha_actual');
    static HORA_ACTUAL = new Formulas('HORA_ACTUAL', 'hora_actual');
    static FECHA_HORA_ACTUAL = new Formulas('FECHA_HORA_ACTUAL', 'fecha_hora_actual');
    static MODELO_A_MODELO = new Formulas('MODELO_A_MODELO', 'modelo_a_modelo');
    static HASH_SHA256 = new Formulas('HASH_SHA256', 'hash_sha256');
    static BOOLEAN_TRUE = new Formulas('BOOLEAN_TRUE', 'boolean_true');
    static BOOLEAN_FALSE = new Formulas('BOOLEAN_FALSE', 'boolean_false');

    /**
     * @type {string}
     * is initialized in the constructor
     */
    key;

    /**
     * @type {string}
     * is initialized in the constructor
     */
    value;

    constructor(key, value) {
        this.#ensureIsValidFormula(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            fecha_actual: Formulas.FECHA_ACTUAL,
            hora_actual: Formulas.HORA_ACTUAL,
            fecha_hora_actual: Formulas.FECHA_HORA_ACTUAL,
            modelo_a_modelo: Formulas.MODELO_A_MODELO,
            hash_sha256: Formulas.HASH_SHA256,
            boolean_false: Formulas.BOOLEAN_FALSE,
            boolean_true: Formulas.BOOLEAN_TRUE,
        };

        if (!map[value]) {
            throw new Error('Invalid key');
        }
        return map[value];
    }

    #ensureIsValidFormula(key) {
        const validKeys = new Set([
            'fecha_actual',
            'hora_actual',
            'fecha_hora_actual',
            'modelo_a_modelo',
            'hash_sha256',
            'boolean_true',
            'boolean_false',
        ]);
        if (!validKeys.has(key)) {
            throw new Error(`The key must be a valid Formula key: ${key}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(Formulas)) {
            if (Formulas[key] instanceof Formulas) {
                json[key] = Formulas[key].value;
            }
        }
        return json;
    }

    static toArray() {
        return [
            Formulas.FECHA_ACTUAL,
            Formulas.HORA_ACTUAL,
            Formulas.FECHA_HORA_ACTUAL,
            Formulas.MODELO_A_MODELO,
            Formulas.HASH_SHA256,
        ];
    }
}
