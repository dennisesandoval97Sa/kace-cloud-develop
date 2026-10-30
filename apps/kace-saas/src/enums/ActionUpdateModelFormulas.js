export class ActionUpdateModelFormulas {
    static FECHA_ACTUAL = new ActionUpdateModelFormulas("FECHA_ACTUAL", "fecha_actual");
    static HORA_ACTUAL = new ActionUpdateModelFormulas("HORA_ACTUAL", "hora_actual");
    static FECHA_HORA_ACTUAL = new ActionUpdateModelFormulas("FECHA_HORA_ACTUAL", "fecha_hora_actual");
    static MODELO_A_MODELO = new ActionUpdateModelFormulas("MODELO_A_MODELO", "modelo_a_modelo");
    static HASH_SHA256 = new ActionUpdateModelFormulas("HASH_SHA256", "hash_sha256");

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

    constructor (key, value) {
        this.#ensureIsValidFormula(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        const map = {
            fecha_actual: ActionUpdateModelFormulas.FECHA_ACTUAL,
            hora_actual: ActionUpdateModelFormulas.HORA_ACTUAL,
            fecha_hora_actual: ActionUpdateModelFormulas.FECHA_HORA_ACTUAL,
            modelo_a_modelo: ActionUpdateModelFormulas.MODELO_A_MODELO,
            hash_sha256: ActionUpdateModelFormulas.HASH_SHA256,
        };

        if (!map[value]) {
            throw new Error("Invalid key");
        }
        return map[value];
    }

    #ensureIsValidFormula (key) {
        const validKeys = new Set([
            "fecha_actual",
            "hora_actual",
            "fecha_hora_actual",
            "modelo_a_modelo",
            "hash_sha256",
        ]);
        if (!validKeys.has(key)) {
            throw new Error(`The key must be a valid Formula key: ${key}`);
        }
    }

    static toJson () {
        const json = {};
        for (const key of Object.keys(ActionUpdateModelFormulas)) {
            if (ActionUpdateModelFormulas[key] instanceof ActionUpdateModelFormulas) {
                json[key] = ActionUpdateModelFormulas[key].value;
            }
        }
        return json;
    }

    static toArray () {
        return [
            ActionUpdateModelFormulas.FECHA_ACTUAL,
            ActionUpdateModelFormulas.HORA_ACTUAL,
            ActionUpdateModelFormulas.FECHA_HORA_ACTUAL,
            ActionUpdateModelFormulas.MODELO_A_MODELO,
            ActionUpdateModelFormulas.HASH_SHA256,
        ];
    }
}
