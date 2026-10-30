import { jest } from '@jest/globals';
import { JobExecutionQueueService, KnexActionJobRepository } from '../../src/action-jobs/index.js';
import { knexConfig } from '../knexfile.js';
import ActionJobMother from './domain/ActionJobMother.js';

describe('JobExecutionQueueService', () => {
    const actionJobRepository = new KnexActionJobRepository(knexConfig);
    const actionExecutionProcessor = {
        processJob: async (id) => {
            const batch = await actionJobRepository.find({ value: id });
            if (batch) {
                batch.markAsInProgress();
                batch.markAsCompleted();
                await actionJobRepository.update(batch);
            }
        },
    };
    const jobExecutionQueueService = new JobExecutionQueueService({ actionJobRepository, actionExecutionProcessor });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return a success message when no pending batches are found', async () => {
        const result = await jobExecutionQueueService.processAllPendingJobs();

        expect(result.status).toBe('success');
        expect(result.message).toBe('No pending jobs found');
    });

    it('should process a pending batch execution successfully', async () => {
        const batch = await ActionJobMother.create(actionJobRepository, { details: {} });

        const result = await jobExecutionQueueService.processAllPendingJobs();

        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(batch.id.value);
        expect(result.data.total).toBe(batch.total_records.value);
        expect(result.data.processed).toBe(batch.processed_records.value);
        expect(result.data.failed).toBe(batch.failed_records.value);
        expect(result.data.isCompleted).toBeTruthy();
        expect(result.data.details).toBeDefined();
    });

    it('should process remaining batches asynchronously', async () => {
        const batch1 = await ActionJobMother.create(actionJobRepository);
        const batch2 = await ActionJobMother.create(actionJobRepository);

        const findPending = actionJobRepository.findPending.bind(actionJobRepository);
        let resolveQueueDrained;
        const queueDrained = new Promise((resolve) => {
            resolveQueueDrained = resolve;
        });
        jest.spyOn(actionJobRepository, 'findPending').mockImplementation(async () => {
            const pendingJob = await findPending();
            if (!pendingJob) resolveQueueDrained();
            return pendingJob;
        });

        const result = await jobExecutionQueueService.processAllPendingJobs();

        expect(result.status).toBe('success');
        expect(result.data.jobId).toBe(batch1.id.value);
        expect(result.data.isCompleted).toBeTruthy();
        await queueDrained;

        const nextBatch = await actionJobRepository.find({ value: batch2.id.value });
        expect(nextBatch.is_completed.value).toBeTruthy();
    }, 10_000);

    it('should handle an error when processing a batch', async () => {
        const batch = await ActionJobMother.create(actionJobRepository);

        actionExecutionProcessor.processJob = async () => {
            throw new Error('Processing failed');
        };

        const result = await jobExecutionQueueService.processAllPendingJobs();

        expect(result.status).toBe('error');
        expect(result.jobId).toBe(batch.id.value);
        expect(result.error).toBe('Processing failed');
    });
});
