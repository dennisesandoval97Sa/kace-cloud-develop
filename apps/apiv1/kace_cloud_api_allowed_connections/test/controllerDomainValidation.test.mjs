import { jest } from '@jest/globals';

const updaterExecute = jest.fn();

class InvalidArgumentError extends Error {}

class BaseControllerStub {
    constructor(event, knexConfig) {
        this.event = event;
        this.database_connection = knexConfig;
    }

    payload() {
        return JSON.parse(this.event.body || '{}');
    }

    pathParameters() {
        return this.event.pathParameters || {};
    }

    validateId() {
        return true;
    }

    async destroyDbConnection() {}
}

const response = (type, statusCode, payload = {}) => ({
    type,
    statusCode,
    ...payload,
});

const HttpResponse = {
    ok: (payload) => response('ok', 200, payload),
    forbidden: (payload) => response('forbidden', 403, payload),
    badRequest: (payload) => response('badRequest', 400, payload),
    validationsFail: (payload) => response('validationsFail', 400, payload),
    internalServerError: (payload) => response('internalServerError', 500, payload),
};

class SearchAuthorizationError extends Error {}

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    HttpResponse,
    SearchAuthorizationError,
    SearchAuthorizationService: jest.fn(),
}));

jest.unstable_mockModule('@kace/api-common/src/security/ObjectIdentityAuthorization.js', () => ({
    objectIdentityErrorResponse: jest.fn(() => null),
    secureObjectCreatePayload: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn() },
    InvalidArgumentError,
}));

jest.unstable_mockModule('@kace/core/src/allowed-conections', () => ({
    AllowedConnectionCreator: jest.fn(),
    AllowedConnectionDeleter: jest.fn(),
    AllowedConnectionFinder: jest.fn(),
    AllowedConnectionSearcher: jest.fn(),
    AllowedConnectionUpdater: jest.fn().mockImplementation(() => ({ execute: updaterExecute })),
    KnexAllowedConnectionsRepository: jest.fn().mockImplementation(() => ({
        destroyConnection: jest.fn(),
    })),
}));

const { Controller } = await import('../src/Controller.mjs');

describe('AllowedConnections Controller domain validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns a controlled bad request when a partial update violates the HTTPS fingerprint invariant', async () => {
        const error = new InvalidArgumentError('certificate: The value must be empty when HTTPS is disabled');
        updaterExecute.mockRejectedValueOnce(error);
        const controller = new Controller(
            {
                body: JSON.stringify({ has_ssl: false }),
                pathParameters: { id: '3c8f195c-a9dd-4a7f-b100-66afe5b3cc29' },
                tenantContext: { readerConfig: { client: 'mock-reader' } },
            },
            { client: 'mock-writer' }
        );
        controller.user = {
            id: { value: '869b0041-fb02-427c-9396-f2e19ddfc161' },
            hasPermission: jest.fn(() => true),
        };

        const result = await controller.actionUpdate();

        expect(result).toMatchObject({
            type: 'badRequest',
            statusCode: 400,
            message: error.message,
            errors: error,
        });
    });
});
