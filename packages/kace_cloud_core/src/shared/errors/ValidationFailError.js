import { BaseError } from './BaseError.js';

export class ValidationFailError extends BaseError {
    /** @type {String} is initialized in the constructor*/
    #field;
    /** @type {Array} is initialized in the constructor*/
    #duplicateFields;

    /** @type {Array|null} Joi details when the failure comes from schema validation */
    #details;

    constructor(message, field, duplicateFields = [], publicErrorCode = null, details = null) {
        super(message, 400, [], publicErrorCode);
        this.#field = field;
        this.#duplicateFields = duplicateFields;
        this.#details = details;
    }

    /**
     * @param {{ message: string, details?: Array<{ path?: Array<string|number>, message?: string }> }} error
     * @param {string} [field='data']
     */
    static fromJoi(error, field = 'data') {
        const details = error?.details ?? [];
        const path = details[0]?.path?.join('.') ?? field;
        return new ValidationFailError(error.message, path, [], null, details);
    }

    get field() {
        return this.#field;
    }

    get duplicateFields() {
        return this.#duplicateFields;
    }

    get details() {
        return this.#details;
    }
}
