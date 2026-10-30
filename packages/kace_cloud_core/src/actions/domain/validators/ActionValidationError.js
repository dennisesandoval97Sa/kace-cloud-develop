export class ActionValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ActionValidationError';
    }
}
