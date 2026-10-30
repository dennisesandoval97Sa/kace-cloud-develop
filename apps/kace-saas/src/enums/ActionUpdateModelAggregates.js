export class ActionUpdateModelAggregates {
    static CLIENTES = new ActionUpdateModelAggregates("CLIENTES", "Client");
    static CASOS = new ActionUpdateModelAggregates("CASOS", "Case");
    static AUX_CASE = new ActionUpdateModelAggregates("AUX_CASE", "AuxCases");
    static AUX_CLIENT = new ActionUpdateModelAggregates("AUX_CLIENT", "AuxClient");

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
        this.#ensureIsValidAggregate(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        const map = {
            Client: ActionUpdateModelAggregates.CLIENTES,
            Case: ActionUpdateModelAggregates.CASOS,
            AuxCases: ActionUpdateModelAggregates.AUX_CASE,
            AuxClient: ActionUpdateModelAggregates.AUX_CLIENT,
        };

        if (!map[value]) {
            throw new Error("Invalid Aggregate");
        }
        return map[value];
    }

    #ensureIsValidAggregate (value) {
        const validValues = new Set(["Client", "Case", "AuxCases", "AuxClient"]);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid Aggregate value: ${value}`);
        }
    }

    static toJson () {
        const json = {};
        for (const key of Object.keys(ActionUpdateModelAggregates)) {
            if (ActionUpdateModelAggregates[key] instanceof ActionUpdateModelAggregates) {
                json[key] = ActionUpdateModelAggregates[key].value;
            }
        }
        return json;
    }
}
