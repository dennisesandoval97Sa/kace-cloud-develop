import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ExecuteReportOnExecutionRequested } from '../../../../src/report-executions/application/event-handlers/ExecuteReportOnExecutionRequested.js';
import { ReportExecution } from '../../../../src/report-executions/domain/ReportExecutions.js';

const EXEC_ID = uuidv4();
const USER_ID = uuidv4();

const REPORT_PARAMS = {
    report: 'agents_performance',
    period: { field: 'created_at', initialDate: '2026-01-01', endDate: '2026-01-31' },
    conditions: [],
};

describe('ExecuteReportOnExecutionRequested', () => {
    let executionRepository;
    let reportCreator;
    let handler;
    let execution;

    beforeEach(() => {
        execution = new ReportExecution({
            id: EXEC_ID,
            name: REPORT_PARAMS.report,
            period: REPORT_PARAMS.period,
            conditions: REPORT_PARAMS.conditions,
            issued_by: USER_ID,
            status: 'pending',
            created_by: USER_ID,
            created_at: new Date(),
        });

        executionRepository = {
            find: jest.fn().mockResolvedValue(execution),
            update: jest.fn().mockResolvedValue(undefined),
        };

        reportCreator = {
            execute: jest.fn(),
        };

        handler = new ExecuteReportOnExecutionRequested(executionRepository, reportCreator);
    });

    function buildEvent(overrides = {}) {
        return {
            aggregateId: EXEC_ID,
            payload: {
                reportName: REPORT_PARAMS.report,
                parameters: REPORT_PARAMS,
                ...overrides,
            },
        };
    }

    it('runs the in_progress → completed cycle on success', async () => {
        const mockResult = {
            s3Location: 's3://bucket/reporting/file.xlsx',
            presignedUrl: 'https://s3.amazonaws.com/bucket/reporting/file.xlsx?signed=true',
            recordCount: 42,
            destinationPath: 'reporting/file.xlsx',
        };
        reportCreator.execute.mockResolvedValue(mockResult);

        const capturedStatuses = [];
        executionRepository.update.mockImplementation((exec) => {
            capturedStatuses.push(exec.status.value);
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(executionRepository.update).toHaveBeenCalledTimes(2);
        expect(capturedStatuses[0]).toBe('in_progress');
        expect(capturedStatuses[1]).toBe('completed');
        expect(reportCreator.execute).toHaveBeenCalledTimes(1);
    });

    it('runs the in_progress → failed cycle on reportCreator error', async () => {
        reportCreator.execute.mockRejectedValue(new Error('S3 upload failed'));

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
            message: 'S3 upload failed',
        });
    });

    it('persists the DB timeout message when available', async () => {
        const timeoutError = new Error('Defined query timeout of 300000ms exceeded when running query.');
        timeoutError.name = 'KnexTimeoutError';
        reportCreator.execute.mockRejectedValue(timeoutError);

        let capturedErrorExecution;
        executionRepository.update.mockImplementation((exec) => {
            capturedErrorExecution = exec;
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(capturedErrorExecution.error.value).toMatchObject({
            message: 'Defined query timeout of 300000ms exceeded when running query.',
            errorName: 'KnexTimeoutError',
            failedAt: expect.any(String),
        });
    });

    it('returns silently if execution not found (no update calls)', async () => {
        executionRepository.find.mockResolvedValue(null);

        await handler.handle(buildEvent());

        expect(executionRepository.update).not.toHaveBeenCalled();
        expect(reportCreator.execute).not.toHaveBeenCalled();
    });

    it('stores the result data after successful completion', async () => {
        const mockResult = {
            s3Location: 's3://bucket/reporting/20260101_agents_performance.xlsx',
            presignedUrl: 'https://presigned-url.example.com/file.xlsx',
            recordCount: 100,
            destinationPath: 'reporting/20260101_agents_performance.xlsx',
        };
        reportCreator.execute.mockResolvedValue(mockResult);

        let capturedResultExecution;
        executionRepository.update.mockImplementation((exec) => {
            capturedResultExecution = exec;
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(capturedResultExecution.result.value).toEqual(mockResult);
        expect(capturedResultExecution.completed_at.value).toBeTruthy();
    });

    it('stores the failedAt timestamp in error payload on failure', async () => {
        reportCreator.execute.mockRejectedValue(new Error('DB connection lost'));

        let capturedErrorExecution;
        executionRepository.update.mockImplementation((exec) => {
            capturedErrorExecution = exec;
            return Promise.resolve(undefined);
        });

        await handler.handle(buildEvent());

        expect(capturedErrorExecution.error.value).toMatchObject({
            message: 'DB connection lost',
            failedAt: expect.any(String),
        });
    });
});
