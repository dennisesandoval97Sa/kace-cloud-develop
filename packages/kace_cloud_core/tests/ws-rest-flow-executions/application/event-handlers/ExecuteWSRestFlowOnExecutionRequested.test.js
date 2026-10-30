import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ExecuteWSRestFlowOnExecutionRequested } from '../../../../src/ws-rest-flow-executions/application/event-handlers/ExecuteWSRestFlowOnExecutionRequested.js';
import { WSRestFlowExecution } from '../../../../src/ws-rest-flow-executions/domain/WSRestFlowExecution.js';

const EXEC_ID = uuidv4();
const FLOW_ID = uuidv4();
const USER_ID = uuidv4();

describe('ExecuteWSRestFlowOnExecutionRequested', () => {
    let executionRepository;
    let workflowExecutor;
    let handler;
    let execution;

    beforeEach(() => {
        execution = new WSRestFlowExecution({
            id: EXEC_ID,
            flow_id: FLOW_ID,
            external_code: null,
            initial_context: null,
            status: 'pending',
            created_by: USER_ID,
            created_at: new Date(),
        });

        executionRepository = {
            find: jest.fn().mockResolvedValue(execution),
            update: jest.fn().mockResolvedValue(undefined),
        };
        workflowExecutor = {
            execute: jest.fn(),
        };
        handler = new ExecuteWSRestFlowOnExecutionRequested(executionRepository, workflowExecutor);
    });

    function buildEvent() {
        return {
            aggregateId: EXEC_ID,
            payload: {
                flowId: FLOW_ID,
                externalCode: null,
                initialContext: null,
            },
        };
    }

    it('runs the in_progress → completed cycle on success', async () => {
        workflowExecutor.execute.mockResolvedValue({ toJson: () => ({ data: 'ok' }) });

        const capturedStatuses = [];
        executionRepository.update.mockImplementation((exec) => {
            capturedStatuses.push(exec.status.value);
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(executionRepository.update).toHaveBeenCalledTimes(2);
        expect(capturedStatuses[0]).toBe('in_progress');
        expect(capturedStatuses[1]).toBe('completed');
    });

    it('runs the in_progress → failed cycle on executor error', async () => {
        workflowExecutor.execute.mockRejectedValue(new Error('kaboom'));

        const capturedStatuses = [];
        const capturedErrors = [];
        executionRepository.update.mockImplementation((exec) => {
            capturedStatuses.push(exec.status.value);
            capturedErrors.push(exec.error.value);
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(executionRepository.update).toHaveBeenCalledTimes(2);
        expect(capturedStatuses[0]).toBe('in_progress');
        expect(capturedStatuses[1]).toBe('failed');
        expect(capturedErrors[1]).toMatchObject({
            message: 'kaboom',
        });
    });

    it('returns silently if execution not found (no update calls)', async () => {
        executionRepository.find.mockResolvedValue(null);

        await handler.handle(buildEvent());

        expect(executionRepository.update).not.toHaveBeenCalled();
        expect(workflowExecutor.execute).not.toHaveBeenCalled();
    });
});
