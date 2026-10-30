import { DomainActionJobFinder } from '../..';
import { Helper, ValidationFailError } from '../../../shared';

export class JobExecutionQueueService {
    /** @type {DomainActionJobFinder} is initialized in the constructor */
    #jobsFinder;
    /** @type {ActionJobProcessingQueueService} is initialized in the constructor */
    #actionExecutionProcessor;
    /** @type {KnexActionJobRepository} is initialized in the constructor */
    #actionJobRepository;
    /** @type {KnexActionJobProcessingRepository} is initialized in the constructor */
    #actionJobProcessingRepository;
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #caseRepository;

    constructor({ actionJobRepository, actionExecutionProcessor, actionExecutionRepository, caseRepository }) {
        this.#actionExecutionProcessor = actionExecutionProcessor;
        this.#jobsFinder = new DomainActionJobFinder(actionJobRepository);
        this.#actionJobRepository = actionJobRepository;
        this.#actionJobProcessingRepository = actionExecutionRepository;
        this.#caseRepository = caseRepository;
    }

    /**
     * Process a single action job by its ID.
     * Used by the event handler to process a specific job triggered by ActionJobCreated event.
     *
     * @param {string} jobId - The UUID of the action job to process
     * @param {WorkflowExecutor} [workflowExecutor] - Optional workflow executor for restflow jobs
     * @returns {Promise<Object>} Result of the job execution
     */
    async processSingleJob(jobId, workflowExecutor) {
        const job = await this.#jobsFinder.execute(jobId);

        if (!job) {
            Helper.logDebug(`JobExecutionQueueService: Job ${jobId} not found`);
            return { status: 'not_found', jobId };
        }

        if (!job.is_pending.value) {
            Helper.logDebug(`JobExecutionQueueService: Job ${jobId} is not pending, skipping`);
            return { status: 'skipped', jobId, reason: 'not_pending' };
        }

        Helper.logDebug(`JobExecutionQueueService: Processing single job ${jobId}`);

        job.markAsInProgress();
        await this.#actionJobRepository.update(job);

        try {
            if (job.restflow_id.value && workflowExecutor) {
                await this.#executeRestflowJob(job, workflowExecutor);
            } else {
                await this.#actionExecutionProcessor.processJob(jobId);
            }

            const updatedJob = await this.#jobsFinder.execute(jobId);

            return {
                status: 'success',
                data: {
                    jobId,
                    total: updatedJob.total_records.value,
                    processed: updatedJob.processed_records.value,
                    failed: updatedJob.failed_records.value,
                    isCompleted: updatedJob.is_completed.value,
                    details: updatedJob.details.value,
                },
            };
        } catch (error) {
            Helper.logError(`JobExecutionQueueService: Error processing job ${jobId}:`, error);

            if (job.restflow_id.value) {
                job.markAsCompleted({
                    status: 'error',
                    error: error.message,
                    stack: error.stack,
                    completedAt: new Date().toISOString(),
                });
                await this.#actionJobRepository.update(job);
            }

            return {
                status: 'error',
                jobId,
                error: error.message,
            };
        }
    }

    /**
     * Get all pending jobs and enqueue them for processing
     * @params {WorkflowExecutor}
     * @returns {Promise<Object>} Result of the first job execution
     */
    async processAllPendingJobs(workflowExecutor) {
        try {
            const pendingJob = await this.#jobsFinder.findPending();

            if (!pendingJob) {
                Helper.logInfo('No pending jobs found');
                return { status: 'success', message: 'No pending jobs found' };
            }

            Helper.logInfo(`Found pending jobs`);

            const jobId = pendingJob.id.value;
            let jobResult = {};
            try {
                if (pendingJob.restflow_id.value) {
                    await this.#executeRestflowJob(pendingJob, workflowExecutor);
                } else {
                    await this.#actionExecutionProcessor.processJob(jobId);
                }

                const updatedJob = await this.#jobsFinder.execute(jobId);

                jobResult = {
                    status: 'success',
                    data: {
                        jobId: jobId,
                        total: updatedJob.total_records.value,
                        processed: updatedJob.processed_records.value,
                        failed: updatedJob.failed_records.value,
                        isCompleted: updatedJob.is_completed.value,
                        details: updatedJob.details.value,
                    },
                };

                if (pendingJob.restflow_id.value) {
                    pendingJob.markAsCompleted({
                        status: 'success',
                        stack: 1,
                        completedAt: new Date().toISOString(),
                    });
                    await this.#actionJobRepository.update(pendingJob);
                }
            } catch (error) {
                Helper.logError(`Error processing job ${jobId}:`, error);
                jobResult = {
                    status: 'error',
                    jobId: jobId,
                    error: error.message,
                };
                if (pendingJob.restflow_id.value) {
                    pendingJob.markAsCompleted({
                        status: 'error',
                        error: error.message,
                        stack: error.stack,
                        completedAt: new Date().toISOString(),
                    });
                    await this.#actionJobRepository.update(pendingJob);
                }
            }

            await this.#processRemainingJobsAsync(workflowExecutor);

            return jobResult;
        } catch (error) {
            Helper.logError('Error processing pending jobs:', error);
            throw new Error(`Error processing pending job. Job ID: ${jobId ?? 'unknown'}`);
        }
    }

    /**
     * Process remaining jobs asynchronously without waiting for them to complete
     */
    async #processRemainingJobsAsync(workflowExecutor) {
        (async () => {
            let nextJob = await this.#jobsFinder.findPending();
            while (nextJob) {
                try {
                    const jobId = nextJob.id.value;
                    Helper.logInfo(`Asynchronously processing job ${jobId}`);
                    if (nextJob.restflow_id.value) {
                        await this.#executeRestflowJob(pendingJob, workflowExecutor);
                    } else {
                        await this.#actionExecutionProcessor.processJob(jobId);
                    }
                    Helper.logInfo(`Completed asynchronous processing of job ${jobId}`);
                } catch (error) {
                    Helper.logError(`Error during async processing of job ${nextJob.id.value}:`, error);
                }
                nextJob = await this.#jobsFinder.findPending();
            }
            Helper.logInfo('Completed processing all remaining jobs');
        })().catch((error) => {
            Helper.logError('Unhandled error in async job processing:', error);
        });
    }

    /**
     *
     * @param job
     * @param {WorkflowExecutor} workflowExecutor
     * @returns {Promise<void>}
     */
    async #executeRestflowJob(job, workflowExecutor) {
        job.markAsInProgress();
        await this.#actionJobRepository.update(job);

        const jobsProcessing = await this.#actionJobProcessingRepository.findByBatchExecutionId(job.id);

        /** @type {ActionJobProcessing} item */
        for (const item of jobsProcessing) {
            let context = {};

            if (item.client_id.value) {
                context = {
                    ...job.restflow_context.value,
                    id: item.client_id.value,
                };
            } else if (item.case_id.value) {
                const caseInfo = await this.#caseRepository.getCaseInformationWithRelations(item.case_id);
                context = {
                    ...job.restflow_context.value,
                    ...caseInfo,
                };
            } else {
                Helper.logError('Job execution require case_id or client_id');
                throw new ValidationFailError('Job execution require case_id or client_id', 'id');
            }

            item.markAsInProgress();
            item.incrementAttempt();
            await this.#actionJobProcessingRepository.update(item);

            try {
                await workflowExecutor.execute({
                    flow_id: job.restflow_id.value,
                    initial_context: context,
                });
                item.markAsCompleted();
            } catch (error) {
                Helper.logError(error.message, error);
                item.markAsFailed([`Fallo la ejecución de la acción`]);
            }

            await this.#actionJobProcessingRepository.update(item);
        }

        job.markAsCompleted({
            status: 'success',
            stack: 1,
            completedAt: new Date().toISOString(),
        });
        await this.#actionJobRepository.update(job);
    }
}
