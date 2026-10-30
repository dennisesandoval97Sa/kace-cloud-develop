import { RuntimeError } from './RuntimeError.js';

export class ResourceNotFoundError extends RuntimeError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`);
    }
}
