import { jest } from '@jest/globals';

// Lightweight BaseController stub so we don't need a real tenant/knex/Cognito setup.
class BaseControllerStub {
    constructor(event) {
        this.event = event;
    }
    payload() {
        return JSON.parse(this.event.body || '{}');
    }
    pathParameters() {
        return this.event.pathParameters || {};
    }
    async getLoggedInUser() {
        return this.event.__user;
    }
    async destroyDbConnection() {}
}

const HttpResponse = {
    ok: (a) => ({ type: 'ok', ...a }),
    forbidden: (a) => ({ type: 'forbidden', ...a }),
    badRequest: (a) => ({ type: 'badRequest', ...a }),
    validationsFail: (a) => ({ type: 'validationsFail', ...a }),
    notFound: (a) => ({ type: 'notFound', ...a }),
    internalServerError: (a) => ({ type: 'internalServerError', ...a }),
};

jest.unstable_mockModule('@kace/api-common', () => ({
    BaseController: BaseControllerStub,
    HttpResponse,
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn(), logDebug: jest.fn() },
}));

// Avoid loading the real DynamoDB-backed service; it is always injected via deps anyway.
jest.unstable_mockModule('../src/services/TenantDebugFlag.mjs', () => ({
    TenantDebugFlag: jest.fn().mockImplementation(() => ({ disable: jest.fn() })),
}));

const { default: Controller } = await import('../src/controller.mjs');

const buildEvent = ({ resource, method, body, pathParameters, superadmin, tenantId = 'acme' }) => ({
    resource,
    httpMethod: method,
    body: body ? JSON.stringify(body) : undefined,
    pathParameters,
    tenantContext: { tenant_id: tenantId },
    __user: { superadmin: { value: superadmin }, login: { value: 'tester' } },
});

const buildDeps = () => ({
    lambdaService: {
        enable: jest.fn().mockResolvedValue({ fnName: 'FN', previousAppsDebug: null, previousAppsDebugLevel: null }),
        disable: jest.fn().mockResolvedValue({ fnName: 'FN' }),
        getStatus: jest.fn().mockResolvedValue({ fnName: 'FN', APPS_DEBUG: 'true', APPS_DEBUG_LEVEL: '1' }),
        normalizeTarget: jest.fn().mockReturnValue('users'),
    },
    scheduler: {
        scheduleDisable: jest
            .fn()
            .mockResolvedValue({ expiresAt: '2026-05-29T00:00:00.000Z', scheduleName: 'debug-disable-users' }),
        cancelPending: jest.fn().mockResolvedValue({ canceled: true }),
        getPending: jest.fn().mockResolvedValue({ expiresAt: null }),
    },
    tenantDebugFlag: {
        disable: jest.fn().mockResolvedValue({ updated: true }),
    },
});

describe('Controller superadmin gate', () => {
    test.each([
        ['/enable', 'POST', { target: 'UsersStack', minutes: 5 }],
        ['/disable', 'POST', { target: 'UsersStack' }],
        ['/status/{target}', 'GET', undefined],
    ])('returns 403 for non-superadmin on %s', async (resource, method, body) => {
        const deps = buildDeps();
        const event = buildEvent({
            resource,
            method,
            body,
            pathParameters: { target: 'UsersStack' },
            superadmin: false,
        });
        const controller = new Controller(event, {}, deps);

        const response = await controller.run();

        expect(response.type).toBe('forbidden');
        expect(deps.lambdaService.enable).not.toHaveBeenCalled();
        expect(deps.lambdaService.disable).not.toHaveBeenCalled();
        expect(deps.tenantDebugFlag.disable).not.toHaveBeenCalled();
    });
});

describe('Controller actions (superadmin)', () => {
    test('enable schedules disable with the request tenantId', async () => {
        const deps = buildDeps();
        const event = buildEvent({
            resource: '/enable',
            method: 'POST',
            body: { target: 'UsersStack', minutes: 10, level: 2 },
            superadmin: true,
            tenantId: 'acme',
        });
        const controller = new Controller(event, {}, deps);

        const response = await controller.run();

        expect(response.type).toBe('ok');
        expect(deps.lambdaService.enable).toHaveBeenCalledWith('UsersStack', 2);
        expect(deps.scheduler.scheduleDisable).toHaveBeenCalledWith('users', 10, 'acme', 'UsersStack');
    });

    test('disable also resets the tenant apps_debug flag in DynamoDB', async () => {
        const deps = buildDeps();
        const event = buildEvent({
            resource: '/disable',
            method: 'POST',
            body: { target: 'UsersStack' },
            superadmin: true,
            tenantId: 'acme',
        });
        const controller = new Controller(event, {}, deps);

        const response = await controller.run();

        expect(response.type).toBe('ok');
        expect(deps.lambdaService.disable).toHaveBeenCalledWith('UsersStack');
        expect(deps.scheduler.cancelPending).toHaveBeenCalledWith('users');
        expect(deps.tenantDebugFlag.disable).toHaveBeenCalledWith('acme');
        expect(response.data.dynamoReset).toBe(true);
    });

    test('status returns current debug state', async () => {
        const deps = buildDeps();
        const event = buildEvent({
            resource: '/status/{target}',
            method: 'GET',
            pathParameters: { target: 'UsersStack' },
            superadmin: true,
        });
        const controller = new Controller(event, {}, deps);

        const response = await controller.run();

        expect(response.type).toBe('ok');
        expect(deps.lambdaService.getStatus).toHaveBeenCalledWith('UsersStack');
    });
});
