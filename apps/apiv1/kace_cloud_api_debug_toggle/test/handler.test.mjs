import { jest } from '@jest/globals';

const disableMock = jest.fn().mockResolvedValue({ fnName: 'DEVAPIUsersStack-users_lambdaZZZZ' });
const tenantDisableMock = jest.fn().mockResolvedValue({ updated: true });

jest.unstable_mockModule('../src/services/LambdaDebugService.mjs', () => ({
    LambdaDebugService: jest.fn().mockImplementation(() => ({ disable: disableMock })),
}));

jest.unstable_mockModule('../src/services/TenantDebugFlag.mjs', () => ({
    TenantDebugFlag: jest.fn().mockImplementation(() => ({ disable: tenantDisableMock })),
}));

jest.unstable_mockModule('@kace/api-common', () => ({
    withTenantContext: (handler) => handler,
}));

jest.unstable_mockModule('../src/controller.mjs', () => ({
    default: jest.fn(),
}));

const { handler } = await import('../src/handler.mjs');
const { SCHEDULE_SOURCE_MARKER } = await import('../src/services/DebugScheduler.mjs');

describe('handler routing', () => {
    beforeEach(() => {
        disableMock.mockClear();
        tenantDisableMock.mockClear();
    });

    test('scheduled disable routes to LambdaDebugService.disable and resets tenant flag', async () => {
        const result = await handler(
            { source: SCHEDULE_SOURCE_MARKER, target: 'users', tenantId: 'acme' },
            { requestId: 'test' }
        );

        expect(disableMock).toHaveBeenCalledWith('users');
        expect(tenantDisableMock).toHaveBeenCalledWith('acme');
        expect(result).toEqual({
            ok: true,
            target: 'users',
            fnName: 'DEVAPIUsersStack-users_lambdaZZZZ',
            dynamoReset: true,
        });
    });

    test('non-scheduled events do NOT trigger disable', async () => {
        const httpEvent = {
            httpMethod: 'POST',
            resource: '/enable',
            body: JSON.stringify({ target: 'users', minutes: 5 }),
            headers: {},
        };
        try {
            await handler(httpEvent, { requestId: 'test' });
        } catch {
            // The controller is mocked to undefined; we only care that disable wasn't called.
        }
        expect(disableMock).not.toHaveBeenCalled();
    });

    test('scheduled payload without target field is treated as HTTP, not scheduled', async () => {
        try {
            await handler({ source: SCHEDULE_SOURCE_MARKER }, { requestId: 'test' });
        } catch {
            // Falls through to HTTP handler with mocked controller; ignore.
        }
        expect(disableMock).not.toHaveBeenCalled();
    });
});
