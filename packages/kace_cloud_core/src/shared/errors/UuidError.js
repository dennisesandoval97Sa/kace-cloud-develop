import { BaseError } from './BaseError.js';

export class UuidError extends BaseError {
    constructor(message) {
        super(message);
    }
}
