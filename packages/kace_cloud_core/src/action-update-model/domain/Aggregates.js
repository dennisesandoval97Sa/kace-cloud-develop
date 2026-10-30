import { Helper } from '../../shared';

export class Aggregates {
    static CLIENTES = new Aggregates('CLIENTES', 'Client');
    static CASOS = new Aggregates('CASOS', 'Case');
    static AUX_CASE = new Aggregates('AUX_CASE', 'AuxCases');
    static AUX_CLIENT = new Aggregates('AUX_CLIENT', 'AuxClient');

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
        this.#ensureIsValidAggregate(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            Client: Aggregates.CLIENTES,
            Case: Aggregates.CASOS,
            AuxCases: Aggregates.AUX_CASE,
            AuxClient: Aggregates.AUX_CLIENT,
        };

        if (!map[value]) {
            Helper.logError(`Invalid value: ${value}`);
            throw new Error('Invalid Aggregate');
        }
        return map[value];
    }

    #ensureIsValidAggregate(value) {
        const validValues = new Set(['Client', 'Case', 'AuxCases', 'AuxClient']);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid Aggregate value: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(Aggregates)) {
            if (Aggregates[key] instanceof Aggregates) {
                json[key] = Aggregates[key].value;
            }
        }
        return json;
    }
}
