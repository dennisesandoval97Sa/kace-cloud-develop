import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ExecuteWSRestFlowOnExecutionRequested {
    /** @type {KnexWSRestFlowExecutionRepository} */
    #executionRepository;

    /** @type {WorkflowExecutor} */
    #workflowExecutor;

    /**
     * @param {KnexWSRestFlowExecutionRepository} executionRepository
     * @param {WorkflowExecutor} workflowExecutor
     */
    constructor(executionRepository, workflowExecutor) {
        this.#executionRepository = executionRepository;
        this.#workflowExecutor = workflowExecutor;
    }

    /**
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const executionId = domainEvent.aggregateId;
        const { flowId, externalCode, initialContext } = domainEvent.payload;

        Helper.logDebug('ExecuteWSRestFlowOnExecutionRequested: Processing execution', {
            executionId,
            flowId,
            externalCode,
        });

        const execution = await this.#executionRepository.find(executionId);

        if (!execution) {
            Helper.logError('ExecuteWSRestFlowOnExecutionRequested: Execution not found', { executionId });
            return;
        }

        execution.markAsInProgress();
        await this.#executionRepository.update(execution);

        try {
            const dto = {};
            if (flowId) dto.flow_id = flowId;
            if (externalCode) dto.external_code = externalCode;
            if (initialContext) dto.initial_context = initialContext;

            const response = await this.#workflowExecutor.execute(dto);

            execution.markAsCompleted(response.toJson());
            await this.#executionRepository.update(execution);

            Helper.logDebug('ExecuteWSRestFlowOnExecutionRequested: Execution completed', {
                executionId,
                status: 'completed',
            });
        } catch (error) {
            Helper.logError('ExecuteWSRestFlowOnExecutionRequested: Execution failed', {
                executionId,
                error: error.message,
            });

            execution.markAsFailed({
                message: error.message,
                stack: error.stack,
                failedAt: new Date().toISOString(),
            });
            await this.#executionRepository.update(execution);
        }
    }
}
