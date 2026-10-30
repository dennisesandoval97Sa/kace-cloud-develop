import { Helper } from '../../../shared';

export class JobQueueProcessor {
    /** @type {JobExecutionQueueService} is initialized in the constructor */
    #jobExecutionQueueService;
    /** @type {WorkflowExecutor} is initialized in the constructor */
    #workflowExecutor;

    constructor(jobExecutionQueueService, workflowExecutor) {
        this.#jobExecutionQueueService = jobExecutionQueueService;
        this.#workflowExecutor = workflowExecutor;
    }

    /**
     * Process all pending batch executions
     * @returns {Promise<Object>} - Result of the first batch execution
     */
    async execute() {
        Helper.logInfo('Starting to process all pending batch executions');
        const result = await this.#jobExecutionQueueService.processAllPendingJobs(this.#workflowExecutor);
        Helper.logInfo('Completed first batch execution', result);
        return result;
    }
}
