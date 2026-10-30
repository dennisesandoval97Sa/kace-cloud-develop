import { RuntimeError } from './RuntimeError.js';

export class MethodNotAllowedError extends RuntimeError {
    constructor(message = 'Method not allowed') {
        super(message);
    }
}
