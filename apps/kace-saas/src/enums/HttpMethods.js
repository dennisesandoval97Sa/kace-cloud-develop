export class HttpMethods {
    static GET = new HttpMethods("GET", "GET");
    static POST = new HttpMethods("POST", "POST");
    static DELETE = new HttpMethods("DELETE", "DELETE");
    static PUT = new HttpMethods("PUT", "PUT");
    static PATCH = new HttpMethods("PATCH", "PATCH");

    constructor (key, value) {
        this.#ensureIsValidMethod(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue (value) {
        if (value === "GET") {
            return HttpMethods.GET;
        }
        if (value === "POST") {
            return HttpMethods.POST;
        }
        if (value === "DELETE") {
            return HttpMethods.DELETE;
        }
        if (value === "PUT") {
            return HttpMethods.PUT;
        }
        if (value === "PATCH") {
            return HttpMethods.PATCH;
        }
        throw new Error("httpMethod: The value is not a valid HTTP method");
    }

    #ensureIsValidMethod (value) {
        if (!value) {
            throw new Error("The value cannot be null");
        }
        if (!["GET", "POST", "DELETE", "PUT", "PATCH"].includes(value)) {
            throw new Error(`The value must be a valid method: ${value}`);
        }
    }

    static toJson () {
        return {
            GET: HttpMethods.GET.value,
            POST: HttpMethods.POST.value,
            DELETE: HttpMethods.DELETE.value,
            PUT: HttpMethods.PUT.value,
            PATCH: HttpMethods.PATCH.value,
        };
    }
}
