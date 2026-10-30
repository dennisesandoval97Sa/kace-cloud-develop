import { jest } from '@jest/globals';
import { AutomatedGroupAssignmentExecutor } from '../../../../src/actions-queue-executions/application/executions/AutomatedGroupAssignmentExecutor.js';
import { RUN_STATUS } from '../../../../src/automated-assignment-runs/domain/services/AssignmentRunObserver.js';

const makeObserver = () => ({
    recordOutcome: jest.fn(),
    recordActionsFound: jest.fn(),
    recordNotApplicableActions: jest.fn(),
    recordTotals: jest.fn(),
    recordError: jest.fn(),
});

const makeBackgroundService = ({ running = false } = {}) => ({
    findBackgroundExecution: jest
        .fn()
        .mockResolvedValue(running ? { execution_status: { value: true }, isStale: () => false } : null),
    updateBackgroundExecution: jest.fn().mockResolvedValue(),
});

const makeAction = (id) => ({
    id: { value: id },
    description: { value: 'desc' },
    action_type: { value: 'asignar_grupo_en_curso' },
});

describe('AutomatedGroupAssignmentExecutor observer instrumentation', () => {
    it('records already_running and skips assignment', async () => {
        const observer = makeObserver();
        const actionsProcessor = { findActionsIfEligible: jest.fn() };
        const service = { assign: jest.fn() };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            service,
            makeBackgroundService({ running: true }),
            observer
        );

        const result = await executor.execute();

        expect(result.skippedReason).toBe('already_running');
        expect(observer.recordOutcome).toHaveBeenCalledWith(RUN_STATUS.ALREADY_RUNNING);
        expect(service.assign).not.toHaveBeenCalled();
        expect(observer.recordTotals).not.toHaveBeenCalled();
        expect(observer.recordActionsFound).not.toHaveBeenCalled();
    });

    it('records no_actions when no eligible actions are found', async () => {
        const observer = makeObserver();
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockResolvedValue([]),
        };
        const service = { assign: jest.fn() };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            service,
            makeBackgroundService(),
            observer
        );

        const result = await executor.execute();

        expect(result.noActions).toBe(true);
        expect(observer.recordOutcome).toHaveBeenCalledWith(RUN_STATUS.NO_ACTIONS);
        expect(observer.recordTotals).not.toHaveBeenCalled();
        expect(observer.recordActionsFound).not.toHaveBeenCalled();
    });

    it('records no_eligible_actions when found actions contain no group-assignment types', async () => {
        const observer = makeObserver();
        const actions = [makeAction('a1')];
        const notApplicable = [{ action: actions[0], reason: 'automation_window_expired' }];
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockResolvedValue(actions),
            process: jest.fn().mockResolvedValue(),
            getGroupAssignmentActions: jest.fn().mockReturnValue([]),
            getNotApplicableActions: jest.fn().mockReturnValue(notApplicable),
            clearProcessedActions: jest.fn(),
        };
        const service = { assign: jest.fn() };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            service,
            makeBackgroundService(),
            observer
        );

        const result = await executor.execute();

        expect(result.noActions).toBe(true);
        expect(observer.recordOutcome).toHaveBeenCalledWith(RUN_STATUS.NO_ELIGIBLE_ACTIONS);
        expect(observer.recordNotApplicableActions).toHaveBeenCalledWith(notApplicable);
        expect(observer.recordActionsFound).not.toHaveBeenCalled();
        expect(observer.recordTotals).not.toHaveBeenCalled();
        expect(service.assign).not.toHaveBeenCalled();
    });

    it('records actions found, totals and completed on a successful run', async () => {
        const observer = makeObserver();
        const actions = [makeAction('a1')];
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockResolvedValue(actions),
            process: jest.fn().mockResolvedValue(),
            getGroupAssignmentActions: jest.fn().mockReturnValue(actions),
            clearProcessedActions: jest.fn(),
        };
        const service = {
            assign: jest.fn().mockResolvedValue({ assigned: 2, skipped: 1, errors: 0 }),
        };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            service,
            makeBackgroundService(),
            observer
        );

        const result = await executor.execute();

        expect(result).toEqual({ assigned: 2, skipped: 1, errors: 0, noActions: false });
        expect(observer.recordActionsFound).toHaveBeenCalledWith(actions);
        expect(observer.recordTotals).toHaveBeenCalledWith({ assigned: 2, skipped: 1, errors: 0 });
        expect(observer.recordOutcome).toHaveBeenCalledWith(RUN_STATUS.COMPLETED);
    });

    it('records the error on a critical failure', async () => {
        const observer = makeObserver();
        const boom = new Error('boom');
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockRejectedValue(boom),
            clearProcessedActions: jest.fn(),
        };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            { assign: jest.fn() },
            makeBackgroundService(),
            observer
        );

        const result = await executor.execute();

        expect(result.criticalError).toBe(true);
        expect(observer.recordError).toHaveBeenCalledWith(boom);
    });

    it('works without an observer (backwards compatible)', async () => {
        const actionsProcessor = {
            findActionsIfEligible: jest.fn().mockResolvedValue([]),
        };
        const executor = new AutomatedGroupAssignmentExecutor(
            actionsProcessor,
            { assign: jest.fn() },
            makeBackgroundService()
        );

        const result = await executor.execute();

        expect(result.noActions).toBe(true);
    });
});
