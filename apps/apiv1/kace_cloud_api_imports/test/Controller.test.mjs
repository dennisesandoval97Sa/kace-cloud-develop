import { jest } from '@jest/globals';
import { randomUUID as uuidv4 } from 'crypto';
import { ImportExecutionRequested } from '@kace/core/src/imports/domain/events/ImportExecutionRequested.js';

const TENANT_ID = uuidv4();
const USER_ID = uuidv4();
const FILE_ID = uuidv4();

const VALID_PAYLOAD = {
    presignedUrl:
        'https://s3pruebaskace.s3.us-east-1.amazonaws.com/helps/4185a606-ebdb-4d45-818e-320576b28dec/test.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAZEE2CGX7T6GAMRWR%2F20250306%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250306T145828Z&X-Amz-Expires=3600&X-Amz-Signature=b62782d00301281d49b3fe6dd72721a9c0826cf52595639a65b89de52cd5e343&X-Amz-SignedHeaders=host',
    targetTable: 'usuarios',
    actionType: 'IMPORT',
};

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
        aws_imports_events_queue_url: vObj('https://sqs.us-east-1.amazonaws.com/123/kace-imports-events-queue.fifo'),
    };
}

function buildFakeEvent({ body = VALID_PAYLOAD } = {}) {
    return {
        httpMethod: 'POST',
        resource: '/imports',
        body: JSON.stringify(body),
        queryStringParameters: {},
        pathParameters: {},
        headers: { Cookie: '', Authorization: null, Host: 'localhost' },
        requestContext: { identity: { sourceIp: '127.0.0.1' } },
        tenantContext: { tenant: buildFakeTenant() },
    };
}

const mockExecute = jest.fn().mockResolvedValue(FILE_ID);
jest.unstable_mockModule('@kace/core/src/imports/application/import/S3FileImport', () => ({
    S3FileImport: jest.fn().mockImplementation(() => ({
        execute: mockExecute,
    })),
}));

const { Controller } = await import('../src/controller.mjs');

async function buildController(opts = {}, hasPermission = true) {
    const fakeKnexConfig = jest.fn();
    const ctrl = new Controller(buildFakeEvent(opts), fakeKnexConfig);

    const mockPublish = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(ctrl, 'eventPublisher', {
        get: () => ({ publish: mockPublish }),
        configurable: true,
    });

    Object.defineProperty(ctrl, 'user', {
        value: {
            id: { value: USER_ID },
            hasPermission: jest.fn().mockReturnValue(hasPermission),
        },
        writable: true,
        configurable: true,
    });

    ctrl._mocks = { mockPublish, mockExecute };
    return ctrl;
}

describe('Imports Controller - actionCreate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 403 forbidden when user lacks permission', async () => {
        const ctrl = await buildController({}, false);
        const response = await ctrl.actionCreate();

        expect(response.statusCode).toBe(403);
    });

    it('returns 400 when validation fails on empty payload', async () => {
        const ctrl = await buildController({ body: {} });
        const response = await ctrl.actionCreate();

        expect(response.statusCode).toBe(400);
    });

    it('persists file and publishes ImportExecutionRequested domain event', async () => {
        const ctrl = await buildController();
        const response = await ctrl.actionCreate();

        expect(response.statusCode).toBe(200);
        expect(mockExecute).toHaveBeenCalledTimes(1);
        expect(ctrl._mocks.mockPublish).toHaveBeenCalledTimes(1);

        const publishedEvent = ctrl._mocks.mockPublish.mock.calls[0][0];
        expect(publishedEvent).toBeInstanceOf(ImportExecutionRequested);
        expect(publishedEvent.eventName).toBe('kace.core.import_execution.requested');
        expect(publishedEvent.fileId).toBe(FILE_ID);
        expect(publishedEvent.targetTable).toBe('usuarios');
        expect(publishedEvent.actionType).toBe('IMPORT');
        expect(publishedEvent.metadata.tenant_id).toBe(TENANT_ID);
        expect(publishedEvent.metadata.user_id).toBe(USER_ID);
    });
});
