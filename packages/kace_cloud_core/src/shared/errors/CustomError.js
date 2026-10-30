import { BaseError } from './BaseError.js';

export class CustomError extends BaseError {
    constructor(message, statusCode, fields, publicErrorCode = null) {
        super(message, statusCode, fields, publicErrorCode);
    }
}
