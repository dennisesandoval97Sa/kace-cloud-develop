export class WSRestEndpointType {
    static CONSUMPTION = new WSRestEndpointType("CONSUMPTION", "consumption");
    static AUTHORIZATION = new WSRestEndpointType("AUTHORIZATION", "authorization");

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
        this.#ensureIsValidEndpintType(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        const map = {
            Consumption: WSRestEndpointType.CONSUMPTION,
            Authorization: WSRestEndpointType.AUTHORIZATION,
        };

        if (!map[value]) {
            throw new Error("Invalid Rest Endpoint Type");
        }
        return map[value];
    }

    #ensureIsValidEndpintType (value) {
        const validValues = new Set(["consumption", "authorization"]);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid Endpoint Type value: ${value}`);
        }
    }

    static toJson () {
        const json = {};
        for (const key of Object.keys(WSRestEndpointType)) {
            if (WSRestEndpointType[key] instanceof WSRestEndpointType) {
                json[key] = WSRestEndpointType[key].value;
            }
        }
        return json;
    }
}
