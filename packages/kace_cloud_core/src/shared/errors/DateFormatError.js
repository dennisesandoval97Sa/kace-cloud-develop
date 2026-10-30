import { BaseError } from './BaseError.js';

export class DateFormatError extends BaseError {
    constructor(message) {
        super(message);
    }
}
