import { CustomError } from '../../shared/errors/CustomError.js';
import { CASE_REOPEN_WINDOW_EXCEEDED } from '@kace/error-codes';

export class CaseReopenWindowExceededError extends CustomError {
    static exposesPublicData = true;
    #days;

    constructor(days) {
        super(`CASE_REOPEN_WINDOW_EXCEEDED:${days}`, 422, [], CASE_REOPEN_WINDOW_EXCEEDED);
        this.#days = days;
    }

    get days() {
        return this.#days;
    }

    toPublicData() {
        return { days: this.#days };
    }
}
