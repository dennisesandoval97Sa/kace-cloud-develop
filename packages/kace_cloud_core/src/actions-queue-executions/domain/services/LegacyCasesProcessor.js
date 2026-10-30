import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class LegacyCasesProcessor {
    /**
     * @param {CaseFindAllActiveService} caseFindAllActiveService - Service to retrieve active (non-closed) cases.
     * @param {CaseActionValidator} caseActionValidator - Service to validate if an action can be applied to a case.
     * @param {number} [concurrencyLimit=50] - Maximum number of concurrent validations.
     */
    constructor(caseFindAllActiveService, caseActionValidator, concurrencyLimit = 50) {
        this.caseFindAllActiveService = caseFindAllActiveService;
        this.caseActionValidator = caseActionValidator;
        this.concurrencyLimit = concurrencyLimit;
        this.activeCases = [];
        this.successOperations = [];
        this.failedOperations = [];
        this.errorOperations = [];
    }

    /**
     * Loads all active (non-closed) cases using the provided service.
     *
     * @returns {Promise<void>}
     */
    async loadActiveCases() {
        this.activeCases = await this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null });
        Helper.logDebug(`LegacyCasesProcessor::loadActiveCases loaded ${this.activeCases.length} active cases`);
    }

    /**
     * Validates and processes all combinations of active cases and actions.
     * Successful and failed operations are recorded separately.
     *
     * @param {Array<Object>} actions - List of actions to be validated with each active case.
     * @returns {Promise<void>}
     */
    async processCasesWithActions(actions) {
        const inputs = this.generateOperationInputs(actions);

        for (let i = 0; i < inputs.length; i += this.concurrencyLimit) {
            const batch = inputs.slice(i, i + this.concurrencyLimit);
            const results = await Promise.all(
                batch.map(({ activeCase, action }) =>
                    this.caseActionValidator
                        .validate(activeCase, action)
                        .then((result) => ({ result, activeCase, action }))
                        .catch((error) => {
                            Helper.logError(
                                `Error validating action ${action.id.value} for case ${activeCase.id.value}`
                            );
                            Helper.logError('Critical error in processCasesWithActions:', error);
                            return { result: false, activeCase, action, error };
                        })
                )
            );

            for (const { result, activeCase, action, error } of results) {
                const op = { case: activeCase, action };
                if (result) {
                    this.successOperations.push(op);
                } else if (error) {
                    this.errorOperations.push({ ...op, error, attempts: 0 });
                } else {
                    this.failedOperations.push({ ...op, attempts: 0 });
                }
            }
        }
    }

    /**
     * Gets the current array of loaded active cases.
     *
     * @returns {Array<Object>}
     */
    getActiveCases() {
        return this.activeCases;
    }

    /**
     * Concatenates external operations results into the current processor pool.
     */
    addSuccessOperations(operations) {
        this.successOperations.push(...operations);
    }

    addFailedOperations(operations) {
        this.failedOperations.push(...operations);
    }

    addErrorOperations(operations) {
        this.errorOperations.push(...operations);
    }

    /**
     * Generates all possible case-action combinations to be validated.
     *
     * @param {Array<Object>} actions - Actions to be paired with each active case.
     * @returns {Array<Object>} List of { activeCase, action } pairs.
     */
    generateOperationInputs(actions) {
        const inputs = [];
        for (const activeCase of this.activeCases) {
            for (const action of actions) {
                inputs.push({ activeCase, action });
            }
        }
        return inputs;
    }

    /**
     * Gets the list of successfully validated operations.
     *
     * @returns {Array<Object>} Successful case-action pairs.
     */
    getSuccessOperations() {
        return this.successOperations;
    }

    /**
     * Gets the list of failed operations (i.e., validations that did not pass).
     *
     * @returns {Array<Object>} Failed case-action pairs with retry metadata.
     */
    getFailedOperations() {
        return this.failedOperations;
    }

    /**
     * Gets the list of operations that encountered errors during validation.
     *
     * @returns {Array<Object>} Error case-action pairs with error details and retry metadata.
     */
    getErrorOperations() {
        return this.errorOperations;
    }

    /**
     * Clears stored successful and failed operations.
     */
    reset() {
        this.successOperations = [];
        this.failedOperations = [];
        this.errorOperations = [];
    }
}
