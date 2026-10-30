import { BaseError } from './BaseError.js';

export class HumanNameError extends BaseError {
    constructor(message) {
        super(message);
    }
}
