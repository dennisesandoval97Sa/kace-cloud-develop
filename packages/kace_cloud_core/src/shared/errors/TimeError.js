import { BaseError } from './BaseError.js';

export class TimeError extends BaseError {
    constructor(message) {
        super(message);
    }
}
