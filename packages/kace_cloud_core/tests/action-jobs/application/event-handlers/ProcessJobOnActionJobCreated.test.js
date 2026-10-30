import { jest } from '@jest/globals';
import { ProcessJobOnActionJobCreated } from '../../../../src/action-jobs/application/event-handlers/ProcessJobOnActionJobCreated.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('ProcessJobOnActionJobCreated', () => {
    let mockJobExecutionQueueService;

    beforeEach(() => {
        mockJobExecutionQueueService = {
            processSingleJob: jest.fn().mockResolvedValue({ status: 'success' }),
        };
    });

    it('should call processSingleJob with the aggregateId from the event', async () => {
        // Arrange
        const jobId = ValueObjectUuid.random();
        const domainEvent = new DomainEvent({
            eventName: 'kace.core.action_job.created',
            aggregateId: jobId,
            payload: { type: 'filter', actionId: ValueObjectUuid.random(), restflowId: null, totalRecords: 100 },
            metadata: { tenant_id: 'tenant-1', user_id: 'user-1' },
        });

        const handler = new ProcessJobOnActionJobCreated(mockJobExecutionQueueService);

        // Act
        await handler.handle(domainEvent);

        // Assert
        expect(mockJobExecutionQueueService.processSingleJob).toHaveBeenCalledTimes(1);
        // El handler reenvia tambien su `workflowExecutor`, que es null cuando no
        // se lo inyectan: los jobs de restflow son los unicos que lo necesitan.
        expect(mockJobExecutionQueueService.processSingleJob).toHaveBeenCalledWith(jobId, null);
    });

    it('should not throw when processSingleJob returns success', async () => {
        // Arrange
        const jobId = ValueObjectUuid.random();
        const domainEvent = new DomainEvent({
            eventName: 'kace.core.action_job.created',
            aggregateId: jobId,
            payload: { type: 'filter_clients', actionId: null, restflowId: ValueObjectUuid.random(), totalRecords: 50 },
            metadata: { tenant_id: 'tenant-2', user_id: 'user-2' },
        });

        const handler = new ProcessJobOnActionJobCreated(mockJobExecutionQueueService);

        // Act & Assert
        await expect(handler.handle(domainEvent)).resolves.toBeUndefined();
    });

    it('should propagate errors from processSingleJob', async () => {
        // Arrange
        mockJobExecutionQueueService.processSingleJob.mockRejectedValue(new Error('Processing failed'));

        const jobId = ValueObjectUuid.random();
        const domainEvent = new DomainEvent({
            eventName: 'kace.core.action_job.created',
            aggregateId: jobId,
            payload: { type: 'file', actionId: ValueObjectUuid.random(), restflowId: null, totalRecords: 10 },
            metadata: { tenant_id: 'tenant-3', user_id: 'user-3' },
        });

        const handler = new ProcessJobOnActionJobCreated(mockJobExecutionQueueService);

        // Act & Assert
        await expect(handler.handle(domainEvent)).rejects.toThrow('Processing failed');
    });
});
