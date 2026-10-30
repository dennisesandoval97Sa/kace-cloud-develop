export class HttpRequestTypes {
    static AUTHORIZATION = new HttpRequestTypes("AUTHORIZATION", "authorization");
    static CONSUMPTION = new HttpRequestTypes("CONSUMPTION", "consumption");

    constructor (key, value) {
        this.#ensureIsValidType(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        if (value === "authorization") {
            return HttpRequestTypes.AUTHORIZATION;
        }
        if (value === "consumption") {
            return HttpRequestTypes.CONSUMPTION;
        }
        throw new Error("requestType: The value is not a valid HTTP request type");
    }

    #ensureIsValidType (value) {
        if (!value) {
            throw new Error("The value cannot be null");
        }
        if (value !== "authorization" && value !== "consumption") {
            throw new Error(`The value must be a valid type: ${value}`);
        }
    }

    static toJson () {
        return {
            AUTHORIZATION: HttpRequestTypes.AUTHORIZATION.value,
            CONSUMPTION: HttpRequestTypes.CONSUMPTION.value,
        };
    }
}
