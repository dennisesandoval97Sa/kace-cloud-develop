import { BaseError } from './BaseError.js';

export class JsonFormatError extends BaseError {
    constructor(message) {
        super(message);
    }
}
