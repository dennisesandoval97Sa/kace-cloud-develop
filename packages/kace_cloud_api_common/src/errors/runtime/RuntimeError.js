import { BaseError } from '../BaseError.js';

export class RuntimeError extends BaseError {
    constructor(message = 'Runtime error') {
        super({ message, statusCode: 500, data: {} });
    }
}
