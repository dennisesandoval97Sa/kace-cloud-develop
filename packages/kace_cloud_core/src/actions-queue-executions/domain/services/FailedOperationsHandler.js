export class FailedOperationsHandler {
    /**
     * @param {Object} caseActionValidator - Validator service used to re-validate failed operations.
     * @param {number} [maxRetries=2] - Maximum number of retry attempts for a failed operation.
     */
    constructor(caseActionValidator, maxRetries = 2) {
        this.caseActionValidator = caseActionValidator;
        this.maxRetries = maxRetries;
    }

    /**
     * Retries the provided list of failed operations.
     * If an operation exceeds the maximum number of retries, it is considered permanently failed.
     *
     * @param {Array<Object>} failedOperations - List of failed operations with `case`, `action`, and `attempts`.
     * @returns {Promise<{ success: Array<Object>, failed: Array<Object> }>}
     * Object containing successfully retried operations and those that are still failed.
     */
    async retry(failedOperations) {
        const success = [];
        const stillFailed = [];

        for (const op of failedOperations) {
            if ((op.attempts ?? 0) >= this.maxRetries) {
                stillFailed.push(op);
                continue;
            }

            op.attempts = (op.attempts ?? 0) + 1;

            const result = await this.caseActionValidator.validate(op.case, op.action);

            if (result) {
                success.push(op);
            } else {
                stillFailed.push(op);
            }
        }

        return { success, failed: stillFailed };
    }
}
