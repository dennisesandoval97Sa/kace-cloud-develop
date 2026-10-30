import { CONFLICT_ERROR } from '@kace/error-codes';
import { CustomError } from '../../shared/errors/CustomError.js';

/** The schedule row stayed locked by another request (a delete or a group save) past the lock timeout. */
export class ScheduleLockConflict extends CustomError {
    constructor() {
        super('The schedule is being modified by another request, try again', 409, [], CONFLICT_ERROR);
    }
}
