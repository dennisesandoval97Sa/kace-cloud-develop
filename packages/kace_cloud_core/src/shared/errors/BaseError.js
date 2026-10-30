export class BaseError extends Error {
    /** @type {Number} is initialized in the constructor*/
    #statusCode;
    /** @type {Array} is initialized in the constructor*/
    #fields;
    /** @type {String|null} is initialized in the constructor*/
    #publicErrorCode;

    constructor(message, statusCode = 500, fields = [], publicErrorCode = null) {
        super(message);
        this.#statusCode = statusCode;
        this.#fields = fields;
        this.#publicErrorCode = publicErrorCode;
    }

    get statusCode() {
        return this.#statusCode;
    }

    get fields() {
        return this.#fields;
    }

    get publicErrorCode() {
        return this.#publicErrorCode;
    }
}
