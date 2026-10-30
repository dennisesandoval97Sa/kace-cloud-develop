import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ProcessJobOnActionJobCreated {
    /** @type {import('../../domain/services/JobExecutionQueueService.js').JobExecutionQueueService} */
    #jobExecutionQueueService;

    /** @type {WorkflowExecutor|null} */
    #workflowExecutor;

    /**
     * @param {JobExecutionQueueService} jobExecutionQueueService
     * @param {WorkflowExecutor} [workflowExecutor] - Required for restflow jobs
     */
    constructor(jobExecutionQueueService, workflowExecutor) {
        this.#jobExecutionQueueService = jobExecutionQueueService;
        this.#workflowExecutor = workflowExecutor || null;
    }

    /**
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const jobId = domainEvent.aggregateId;

        Helper.logDebug('ProcessJobOnActionJobCreated: Processing job', {
            jobId,
            type: domainEvent.payload.type,
        });

        const result = await this.#jobExecutionQueueService.processSingleJob(jobId, this.#workflowExecutor);

        Helper.logDebug('ProcessJobOnActionJobCreated: Job processing completed', {
            jobId,
            status: result.status,
        });
    }
}
