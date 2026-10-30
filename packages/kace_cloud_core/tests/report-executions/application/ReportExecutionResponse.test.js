import { v4 as uuidv4 } from 'uuid';
import { ReportExecution } from '../../../src/report-executions/domain/ReportExecutions.js';
import { ReportExecutionResponse } from '../../../src/report-executions/application/ReportExecutionResponse.js';

const USER_ID = uuidv4();

function buildExecution(overrides = {}) {
    return new ReportExecution({
        id: uuidv4(),
        name: 'agents_performance',
        period: { field: 'created_at', initialDate: '2026-01-01', endDate: '2026-01-31' },
        conditions: [],
        issued_by: USER_ID,
        status: 'pending',
        created_by: USER_ID,
        created_at: new Date(),
        ...overrides,
    });
}

describe('ReportExecutionResponse', () => {
    it('serializes a pending execution correctly', () => {
        const exec = buildExecution();
        const response = new ReportExecutionResponse(exec);
        const json = response.toJson();

        expect(json.status).toBe('pending');
        expect(json.report_name).toBe('agents_performance');
        expect(json.result).toBeFalsy();
        expect(json.error).toBeFalsy();
        expect(json.started_at).toBeFalsy();
        expect(json.completed_at).toBeFalsy();
        expect(json.id).toBeTruthy();
    });

    it('serializes a completed execution with result data', () => {
        const resultData = {
            presignedUrl: 'https://s3.example.com/report.xlsx',
            s3Location: 's3://bucket/reporting/report.xlsx',
            recordCount: 55,
            destinationPath: 'reporting/report.xlsx',
        };

        const exec = buildExecution({ status: 'completed' });
        exec.markAsCompleted(resultData);

        const response = new ReportExecutionResponse(exec);
        const json = response.toJson();

        expect(json.status).toBe('completed');
        expect(json.result).toEqual(resultData);
        expect(json.completed_at).toBeTruthy();
        expect(json.error).toBeFalsy();
    });

    it('serializes a failed execution with error data', () => {
        const errorData = { message: 'Timeout', failedAt: new Date().toISOString() };

        const exec = buildExecution();
        exec.markAsFailed(errorData);

        const response = new ReportExecutionResponse(exec);
        const json = response.toJson();

        expect(json.status).toBe('failed');
        expect(json.error).toEqual(errorData);
        expect(json.result).toBeFalsy();
    });

    it('includes period and conditions in the parameters field', () => {
        const period = { field: 'created_at', initialDate: '2026-01-01', endDate: '2026-01-31' };
        const conditions = [{ field: 'status', operator: '=', value: 'active', type: 'string' }];

        const exec = buildExecution({ period, conditions });
        const json = new ReportExecutionResponse(exec).toJson();

        expect(json.parameters.period).toEqual(period);
        expect(json.parameters.conditions).toEqual(conditions);
    });
});
