export class ErrorCollector {
    #errors = [];

    /**
     * Adds a new error to the collection
     * @param {string} field - Path or name of the field with the error
     * @param {string} message - Description of the error
     * @param {string} type - Type of error (default is 'validation'; can also be 'structure')
     */
    addError(field, message, type = 'validation') {
        this.#errors.push({ field, message, type });
    }

    /**
     * Checks if there are any collected errors
     * @returns {boolean} - Returns `true` if there are errors, otherwise `false`
     */
    hasErrors() {
        return this.#errors.length > 0;
    }

    /**
     * Returns a copy of the error array and clears the collection
     * @returns {Array} - List of collected errors
     */
    getErrors() {
        return [...this.#errors];
    }

    /**
     * Returns a copy of the error array and clears the collection
     * @returns {Array} - List of collected errors
     */
    getAndClearErrors() {
        const errors = [...this.#errors];
        this.#errors = [];
        return errors;
    }

    /**
     * Clears all stored errors
     */
    clear() {
        this.#errors = [];
    }

    /**
     * Returns a string with all error messages concatenated
     * @returns {string} - String with all error messages
     */
    errorMessages() {
        return this.#errors.map((error) => `${error.field}: ${error.message}`).join(', ');
    }

    toJSON() {
        const errorObj = {};
        this.#errors.forEach(({ field, message }) => {
            errorObj[field] = message;
        });
        return errorObj;
    }
}
