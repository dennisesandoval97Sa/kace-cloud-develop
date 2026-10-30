import { v4 as uuidv4 } from 'uuid';
import { ReportExecutionRequested } from '../../../../src/report-executions/domain/events/ReportExecutionRequested.js';

describe('ReportExecutionRequested domain event', () => {
    const EXEC_ID = uuidv4();
    const TENANT_ID = uuidv4();
    const USER_ID = uuidv4();
    const PARAMETERS = {
        report: 'agents_performance',
        period: { field: 'created_at', initialDate: '2026-01-01', endDate: '2026-01-31' },
        conditions: [],
    };

    it('creates the event with correct EVENT_NAME constant', () => {
        expect(ReportExecutionRequested.EVENT_NAME).toBe('kace.core.report_execution.requested');
    });

    it('creates the event with the correct aggregateId and payload', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
            reportName: PARAMETERS.report,
            parameters: PARAMETERS,
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        expect(event.aggregateId).toBe(EXEC_ID);
        expect(event.eventName).toBe(ReportExecutionRequested.EVENT_NAME);
        expect(event.payload.reportName).toBe(PARAMETERS.report);
        expect(event.payload.parameters).toEqual(PARAMETERS);
    });

    it('stores metadata correctly', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
            reportName: PARAMETERS.report,
            parameters: PARAMETERS,
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        expect(event.metadata.tenant_id).toBe(TENANT_ID);
        expect(event.metadata.user_id).toBe(USER_ID);
    });

    it('defaults reportName and parameters to null/{} when not provided', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
        });

        expect(event.payload.reportName).toBeNull();
        expect(event.payload.parameters).toEqual({});
    });

    it('generates a valid eventId and occurredOn timestamp', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
            reportName: PARAMETERS.report,
            parameters: PARAMETERS,
        });

        expect(event.eventId).toBeTruthy();
        expect(event.occurredOn).toBeTruthy();
        expect(new Date(event.occurredOn).toString()).not.toBe('Invalid Date');
    });

    it('is immutable (frozen)', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
            reportName: PARAMETERS.report,
            parameters: PARAMETERS,
        });

        expect(Object.isFrozen(event)).toBe(true);
    });

    it('serializes toJson correctly', () => {
        const event = new ReportExecutionRequested({
            executionId: EXEC_ID,
            reportName: PARAMETERS.report,
            parameters: PARAMETERS,
            metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
        });

        const json = event.toJson();

        expect(json.eventName).toBe(ReportExecutionRequested.EVENT_NAME);
        expect(json.aggregateId).toBe(EXEC_ID);
        expect(json.payload.reportName).toBe(PARAMETERS.report);
        expect(json.metadata.tenant_id).toBe(TENANT_ID);
    });
});
