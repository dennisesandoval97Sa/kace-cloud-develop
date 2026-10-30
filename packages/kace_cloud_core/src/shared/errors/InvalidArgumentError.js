import { DomainError } from './DomainError.js';

export class InvalidArgumentError extends DomainError {
    constructor(message, statusCode = 400, publicErrorCode = null) {
        super(message, statusCode, publicErrorCode);
    }
}
