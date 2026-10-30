import { BaseError } from './BaseError.js';

export default class BehaviorNotSupportedError extends BaseError {
    constructor(message, statusCode = 500, fields = []) {
        super(message, statusCode, fields);
    }
}
