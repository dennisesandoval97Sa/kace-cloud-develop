export class BaseError extends Error {
    /** @type {number} is initialized in the constructor */
    #statusCode;
    /** @type {object} is initialized in the constructor*/
    #data;

    constructor({ message = 'Error', statusCode = 500, data = {} }) {
        super(message);
        this.#statusCode = statusCode;
        this.#data = data;
    }

    get statusCode() {
        return this.#statusCode;
    }

    get data() {
        return this.#data;
    }
}
