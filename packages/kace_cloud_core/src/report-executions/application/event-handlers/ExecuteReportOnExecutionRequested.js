import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ValueObjectUuid } from '../../../shared/index.js';

export class ExecuteReportOnExecutionRequested {
    /** @type {KnexReportExecutionsRepository} */
    #executionRepository;

    /** @type {ReportCreator} */
    #reportCreator;

    /**
     * @param {KnexReportExecutionsRepository} executionRepository
     * @param {ReportCreator} reportCreator
     */
    constructor(executionRepository, reportCreator) {
        this.#executionRepository = executionRepository;
        this.#reportCreator = reportCreator;
    }

    /**
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const executionId = new ValueObjectUuid('id', domainEvent.aggregateId);
        const { reportName, parameters } = domainEvent.payload;

        Helper.logDebug('ExecuteReportOnExecutionRequested: Processing execution', {
            executionId: executionId.value,
            reportName,
        });

        const execution = await this.#executionRepository.find(executionId);

        if (!execution) {
            Helper.logError('ExecuteReportOnExecutionRequested: Execution not found', {
                executionId: executionId.value,
            });
            return;
        }

        execution.markAsInProgress();
        await this.#executionRepository.update(execution);

        try {
            const storagePrefix = process.env.REPORTS_S3_PREFIX ?? '';
            const exportOptions = { title: parameters.report };

            const result = await this.#reportCreator.execute(parameters, storagePrefix, exportOptions);

            execution.markAsCompleted(result);
            await this.#executionRepository.update(execution);

            Helper.logDebug('ExecuteReportOnExecutionRequested: Execution completed', {
                executionId: executionId.value,
                status: 'completed',
            });
        } catch (error) {
            Helper.logError('ExecuteReportOnExecutionRequested: Execution failed', {
                executionId: executionId.value,
                error: error.message,
            });

            try {
                execution.markAsFailed({
                    message: error?.message || 'Report generation failed.',
                    errorName: error?.name ?? 'Error',
                    failedAt: new Date().toISOString(),
                });
            } catch (markAsFailedError) {
                Helper.logError('ExecuteReportOnExecutionRequested: Failed to build failure payload', {
                    executionId: executionId.value,
                    error: markAsFailedError?.message,
                });

                execution.markAsFailed({
                    message: 'Report execution failed.',
                    errorName: 'Error',
                    failedAt: new Date().toISOString(),
                });
            }

            await this.#executionRepository.update(execution);
        }
    }
}
