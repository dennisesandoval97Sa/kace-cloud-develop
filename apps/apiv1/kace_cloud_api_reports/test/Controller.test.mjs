/**
 * Controller unit tests for the Reports API.
 *
 * Strategy: We construct a real Controller instance by calling `new Controller(event, knexConfig)`
 * with a minimal synthetic event and a fake knexConfig, so that all private fields
 * (#event, #tenant, #user, #eventPublisher, etc.) declared in BaseController are
 * properly initialised.
 *
 * After construction we immediately replace all heavy infrastructure dependencies
 * (executionRepository, reportCreator, eventPublisher, etc.) with Jest mocks so
 * that no real DB / S3 / Cognito calls are made.
 *
 * The `user` setter in BaseController validates `instanceof User`, so we bypass
 * it by setting ctrl.user via the prototype setter with a test User-like object that
 * satisfies the runtime check through jest.spyOn.
 */
import { jest } from '@jest/globals';
import { randomUUID as uuidv4 } from 'crypto';
import { ReportExecution } from '@kace/core/src/report-executions/domain/ReportExecutions.js';

// ── Constants ────────────────────────────────────────────────────────────────
const TENANT_ID = uuidv4();
const USER_ID = uuidv4();

const VALID_PAYLOAD = {
    report: 'agents_performance',
    period: { field: 'created_at', initialDate: '2026-01-01', endDate: '2026-01-31' },
    conditions: [],
};

const REPORT_RESULT = {
    s3Location: 's3://bucket/reporting/file.xlsx',
    presignedUrl: 'https://s3.amazonaws.com/file.xlsx?signed=true',
    recordCount: 10,
    destinationPath: 'reporting/file.xlsx',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal tenant object that satisfies BaseController constructor. */
function buildFakeTenant(id = TENANT_ID) {
    const vObj = (v) => ({ value: v });
    return {
        id: vObj(id),
        aws_cognito_user_pool_id: vObj('us-east-1_TEST'),
        aws_cognito_app_client_id: vObj('test-client-id'),
        aws_s3_region: vObj('us-east-1'),
        aws_s3_access_key_id: vObj('AKIATEST'),
        aws_s3_secret_access_key: vObj('secret'),
        aws_s3_bucket: vObj('test-bucket'),
        aws_sqs_region: vObj('us-east-1'),
        aws_sqs_access_key_id: vObj('AKIATEST'),
        aws_sqs_secret_access_key: vObj('secret'),
    };
}

/** Minimal event that satisfies BaseController constructor + action methods. */
function buildFakeEvent({
    httpMethod = 'POST',
    resource = '/',
    body = VALID_PAYLOAD,
    queryStringParameters = {},
    pathParameters = {},
} = {}) {
    return {
        httpMethod,
        resource,
        body: JSON.stringify(body),
        queryStringParameters,
        pathParameters,
        headers: { Cookie: '', Authorization: null, Host: 'localhost' },
        requestContext: { identity: { sourceIp: '127.0.0.1' } },
        tenantContext: { tenant: buildFakeTenant() },
    };
}

/**
 * Builds a real Controller instance with all infrastructure dependencies
 * replaced by Jest mocks.
 *
 * We call `new Controller(event, knexConfig)` with enough shape to pass the
 * BaseController constructor guard, then override every I/O dependency with mocks.
 * This is the only approach that works when private class fields (#event, #tenant,
 * etc.) span the BaseController ↔ Controller prototype chain.
 */
async function buildController(opts = {}) {
    const { Controller } = await import('../src/Controller.mjs');

    const mockSave = jest.fn().mockResolvedValue(undefined);
    const mockUpdate = jest.fn().mockResolvedValue(undefined);
    const mockFind = jest.fn().mockResolvedValue(null);
    const mockPublish = jest.fn().mockResolvedValue(undefined);
    const mockReportCreatorExecute = jest.fn().mockResolvedValue(REPORT_RESULT);

    // Pass a FUNCTION as knexConfig: KnexRepository checks `typeof config !== 'function'`
    // before calling `Knex(config)`. When it IS a function, it's used directly as the
    // connection, bypassing the real Knex initialisation entirely.
    // All nested repositories (KnexUsersRepository, etc.) receive the same function
    // and behave the same way. We override them all with mocks right after construction.
    const fakeKnexConfig = jest.fn();

    // Build the real instance – all private fields are now correctly initialised
    const ctrl = new Controller(buildFakeEvent(opts), fakeKnexConfig);

    // Replace every infrastructure dep with mocks AFTER construction
    ctrl.executionRepository = { save: mockSave, update: mockUpdate, find: mockFind };
    ctrl.reportCreator = { execute: mockReportCreatorExecute };
    ctrl.reportColumnFinder = { execute: jest.fn() };
    ctrl.reportDistinctValuesFinder = { execute: jest.fn() };

    // Override the eventPublisher (it's exposed via getter from BaseController)
    Object.defineProperty(ctrl, 'eventPublisher', {
        get: () => ({ publish: mockPublish }),
        configurable: true,
    });

    // Stub destroyDbConnection so no teardown is attempted
    ctrl.destroyDbConnection = jest.fn().mockResolvedValue(undefined);

    // user: BaseController setter validates `instanceof User` – bypass with a spy
    ctrl.getLoggedInUser = jest.fn().mockResolvedValue({ id: { value: USER_ID } });
    // Set user directly on the object (bypasses the setter validation)
    Object.defineProperty(ctrl, 'user', {
        value: { id: { value: USER_ID } },
        writable: true,
        configurable: true,
    });

    // Expose mocks for assertions
    ctrl._mocks = { mockSave, mockUpdate, mockFind, mockPublish, mockReportCreatorExecute };

    return ctrl;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Reports Controller – actionCreate', () => {
    it('returns 202 Accepted with execution_id when called without ?sync=true', async () => {
        const ctrl = await buildController();

        const response = await ctrl.actionCreate();
        const json = response.toJson();

        expect(json.statusCode).toBe(202);
        const body = JSON.parse(json.body);
        expect(body.data.execution_id).toBeTruthy();
        expect(body.data.status).toBe('pending');
    });

    it('saves the execution with status pending before publishing the event', async () => {
        const ctrl = await buildController();

        await ctrl.actionCreate();

        expect(ctrl._mocks.mockSave).toHaveBeenCalledTimes(1);
        const savedExecution = ctrl._mocks.mockSave.mock.calls[0][0];
        expect(savedExecution.status.value).toBe('pending');
        expect(savedExecution.name.value).toBe(VALID_PAYLOAD.report);
    });

    it('publishes ReportExecutionRequested domain event with correct payload', async () => {
        const ctrl = await buildController();

        await ctrl.actionCreate();

        expect(ctrl._mocks.mockPublish).toHaveBeenCalledTimes(1);
        const domainEvent = ctrl._mocks.mockPublish.mock.calls[0][0];
        expect(domainEvent.eventName).toBe('kace.core.report_execution.requested');
        expect(domainEvent.payload.reportName).toBe(VALID_PAYLOAD.report);
        expect(domainEvent.metadata.tenant_id).toBe(TENANT_ID);
        expect(domainEvent.metadata.user_id).toBe(USER_ID);
    });

    it('does NOT call reportCreator.execute() directly', async () => {
        const ctrl = await buildController();

        await ctrl.actionCreate();

        expect(ctrl._mocks.mockReportCreatorExecute).not.toHaveBeenCalled();
    });

    it('returns 400 when payload fails schema validation', async () => {
        const ctrl = await buildController({ body: { report: '' } });

        const response = await ctrl.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(ctrl._mocks.mockSave).not.toHaveBeenCalled();
        expect(ctrl._mocks.mockPublish).not.toHaveBeenCalled();
    });

    it('returns 400 when period is missing', async () => {
        const ctrl = await buildController({ body: { report: 'my_report' } });

        const response = await ctrl.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
    });
});

describe('Reports Controller – actionRead (Execution Status)', () => {
    it('returns 200 with serialized execution data when found', async () => {
        const execId = uuidv4();
        const ctrl = await buildController({
            httpMethod: 'GET',
            resource: '/{id}',
            pathParameters: { id: execId },
        });

        const mockExec = new ReportExecution({
            id: execId,
            name: 'my_report',
            period: VALID_PAYLOAD.period,
            conditions: [],
            status: 'completed',
            issued_by: USER_ID,
            created_by: USER_ID,
        });
        mockExec.markAsCompleted(REPORT_RESULT);
        ctrl._mocks.mockFind.mockResolvedValue(mockExec);

        const response = await ctrl.actionRead();
        const json = response.toJson();
        const body = JSON.parse(json.body);

        expect(json.statusCode).toBe(200);
        expect(body.data.status).toBe('completed');
        expect(body.data.result).toEqual(REPORT_RESULT);
        expect(body.data.report_name).toBe('my_report');
    });

    it('returns 404 when execution is not found', async () => {
        const ctrl = await buildController({
            httpMethod: 'GET',
            resource: '/{id}',
            pathParameters: { id: uuidv4() },
        });
        ctrl._mocks.mockFind.mockResolvedValue(null);

        const response = await ctrl.actionRead();
        expect(response.toJson().statusCode).toBe(404);
    });

    it('returns 400 when the id is not a valid UUID', async () => {
        const ctrl = await buildController({
            httpMethod: 'GET',
            resource: '/{id}',
            pathParameters: { id: 'not-a-valid-uuid' },
        });

        const response = await ctrl.actionRead();
        expect(response.toJson().statusCode).toBe(400);
    });
});
