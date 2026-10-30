export class ActionUpdateModelTypes {
    static ALFANUMERICO = new ActionUpdateModelTypes("Alfanumérico", "alfanumerico");
    static NUMERO = new ActionUpdateModelTypes("Número", "numero");
    static FORMULA = new ActionUpdateModelTypes("Formula", "formula");

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
        this.#ensureIsValidType(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        const map = {
            alfanumerico: ActionUpdateModelTypes.ALFANUMERICO,
            numero: ActionUpdateModelTypes.NUMERO,
            formula: ActionUpdateModelTypes.FORMULA,
        };

        if (!map[value]) {
            throw new Error("Invalid type");
        }
        return map[value];
    }

    #ensureIsValidType (value) {
        const validValues = new Set(["alfanumerico", "numero", "formula"]);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid Type: ${value}`);
        }
    }

    static toJson () {
        const json = {};
        for (const key of Object.keys(ActionUpdateModelTypes)) {
            if (ActionUpdateModelTypes[key] instanceof ActionUpdateModelTypes) {
                json[key] = ActionUpdateModelTypes[key].value;
            }
        }
        return json;
    }
}
