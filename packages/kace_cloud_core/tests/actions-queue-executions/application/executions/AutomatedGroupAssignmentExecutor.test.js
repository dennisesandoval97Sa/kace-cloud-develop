import { jest } from '@jest/globals';
import { AutomatedGroupAssignmentExecutor } from '../../../../src/actions-queue-executions/application/executions/AutomatedGroupAssignmentExecutor.js';
import { BackgroundProcessEnum } from '../../../../src/shared/domain/enum/BackgroundProcessEnum.js';

describe('AutomatedGroupAssignmentExecutor stale lock', () => {
    const buildSut = (backgroundExecutionService) => {
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockResolvedValue([]),
            process: jest.fn(),
            getGroupAssignmentActions: jest.fn().mockReturnValue([]),
            clearProcessedActions: jest.fn(),
        };
        const automatedGroupAssignmentService = { assign: jest.fn() };
        return new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            automatedGroupAssignmentService,
            backgroundExecutionService
        );
    };

    it('proceeds when execution_status is true but lock is stale', async () => {
        const stale = {
            execution_status: { value: true },
            isStale: jest.fn().mockReturnValue(true),
        };
        const service = {
            findBackgroundExecution: jest.fn().mockResolvedValue(stale),
            updateBackgroundExecution: jest.fn().mockResolvedValue(undefined),
        };
        const sut = buildSut(service);

        const result = await sut.execute();

        expect(stale.isStale).toHaveBeenCalledWith(30);
        expect(result.skippedReason).toBeUndefined();
        expect(service.updateBackgroundExecution).toHaveBeenCalledWith(
            BackgroundProcessEnum.AUTOMATED_GROUP_ASSIGNMENT.value,
            expect.objectContaining({ execution_status: true })
        );
    });

    it('skips when execution_status is true and lock is fresh', async () => {
        const fresh = {
            execution_status: { value: true },
            isStale: jest.fn().mockReturnValue(false),
        };
        const service = {
            findBackgroundExecution: jest.fn().mockResolvedValue(fresh),
            updateBackgroundExecution: jest.fn(),
        };
        const sut = buildSut(service);

        const result = await sut.execute();

        expect(result.skippedReason).toBe('already_running');
        expect(service.updateBackgroundExecution).not.toHaveBeenCalled();
    });
});
