import {BaseError} from "./BaseError.js";

export default class AuthFailError extends BaseError{
    #errorCode; // is initialized in the constructor
    get errorCode() {
        return this.#errorCode;
    }

    constructor(message, statusCode,errorCode) {
        super(message, statusCode);
        this.#errorCode = errorCode;
    }
}