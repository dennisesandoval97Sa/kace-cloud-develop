import { BaseError } from './BaseError.js';

export class RuntimeError extends BaseError {
    constructor(message) {
        super(message);
    }
}
