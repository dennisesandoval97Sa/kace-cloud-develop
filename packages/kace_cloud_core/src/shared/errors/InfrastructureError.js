import { BaseError } from './BaseError.js';

export class InfrastructureError extends BaseError {
    constructor(message, options = {}) {
        super(message, 500);
        this.name = 'InfrastructureError';
        if (options && options.cause) {
            this.cause = options.cause;
        }
    }
}
