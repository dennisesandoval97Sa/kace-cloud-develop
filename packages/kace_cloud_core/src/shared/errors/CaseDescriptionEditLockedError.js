import { CustomError } from './CustomError.js';
import { CASE_DESCRIPTION_EDIT_LOCKED } from '@kace/error-codes';

export class CaseDescriptionEditLockedError extends CustomError {
    constructor(message = 'Case description editing is locked by global configuration', fields = []) {
        super(message, 400, fields, CASE_DESCRIPTION_EDIT_LOCKED);
    }
}
