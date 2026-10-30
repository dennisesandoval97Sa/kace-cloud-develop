import { jest } from '@jest/globals';

const transitionRun = jest.fn();
const closeRun = jest.fn();
const assignRun = jest.fn();
const transitionController = jest.fn(() => ({ run: transitionRun }));
const closeController = jest.fn(() => ({ run: closeRun }));
const assignController = jest.fn(() => ({ run: assignRun }));

jest.unstable_mockModule('@kace/api-common', () => ({
    HttpResponse: {
        notFound: () => ({
            toJson: () => ({
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Not found',
                    data: { code: '0x050004' },
                    metadata: { request_id: 'unknown' },
                }),
            }),
        }),
    },
    withTenantContext: (fn) => fn,
}));

jest.unstable_mockModule('../src/BulkTransitionController.mjs', () => ({
    BulkTransitionController: transitionController,
}));

jest.unstable_mockModule('../src/BulkCloseController.mjs', () => ({
    BulkCloseController: closeController,
}));

jest.unstable_mockModule('../src/BulkAssignController.mjs', () => ({
    BulkAssignController: assignController,
}));

const { baseHandler } = await import('../src/handler.mjs');

function response(statusCode) {
    return {
        toJson: () => ({
            statusCode,
            body: JSON.stringify({ data: { updated: 1 } }),
        }),
    };
}

function eventFor(resource, httpMethod = 'POST') {
    return {
        resource,
        httpMethod,
        tenantContext: {
            knexConfig: { client: 'sqlite3' },
        },
    };
}

describe('cases bulk handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        transitionRun.mockResolvedValue(response(200));
        closeRun.mockResolvedValue(response(200));
        assignRun.mockResolvedValue(response(200));
    });

    it('routes supported bulk case requests to their controllers', async () => {
        await baseHandler(eventFor('/transition'));
        await baseHandler(eventFor('/close'));
        await baseHandler(eventFor('/assign'));

        expect(transitionController).toHaveBeenCalledTimes(1);
        expect(closeController).toHaveBeenCalledTimes(1);
        expect(assignController).toHaveBeenCalledTimes(1);
    });

    it('returns a public error contract for unsupported routes', async () => {
        const result = await baseHandler(eventFor('/transition', 'GET'));
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(404);
        expect(body).toEqual({
            message: 'Not found',
            data: { code: '0x050004' },
            metadata: { request_id: 'unknown' },
        });
        expect(transitionController).not.toHaveBeenCalled();
    });
});
