import { BaseError } from './BaseError.js';

export class DomainError extends BaseError {
    constructor(message, statusCode = 400, publicErrorCode = null) {
        super(message, statusCode, [], publicErrorCode);
    }
}
