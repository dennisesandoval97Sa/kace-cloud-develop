import { jest } from '@jest/globals';

const moveRun = jest.fn();
const closeRun = jest.fn();
const deleteRun = jest.fn();
const moveController = jest.fn(() => ({ run: moveRun }));
const closeController = jest.fn(() => ({ run: closeRun }));
const deleteController = jest.fn(() => ({ run: deleteRun }));
const destinationsRun = jest.fn();
const destinationsController = jest.fn(() => ({ run: destinationsRun }));

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

jest.unstable_mockModule('../src/BulkMoveController.mjs', () => ({
    BulkMoveController: moveController,
}));

jest.unstable_mockModule('../src/BulkCloseController.mjs', () => ({
    BulkCloseController: closeController,
}));

jest.unstable_mockModule('../src/BulkDeleteController.mjs', () => ({
    BulkDeleteController: deleteController,
}));

jest.unstable_mockModule('../src/AgentMoveDestinationsController.mjs', () => ({
    AgentMoveDestinationsController: destinationsController,
}));

const { baseHandler, handler } = await import('../src/handler.mjs');

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

describe('interactions bulk handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        moveRun.mockResolvedValue(response(200));
        closeRun.mockResolvedValue(response(200));
        deleteRun.mockResolvedValue(response(200));
        destinationsRun.mockResolvedValue(response(200));
    });

    it('routes POST /move to the move controller with BaseController resource shape', async () => {
        const result = await handler(eventFor('/move'));

        expect(moveController).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: '/',
                httpMethod: 'POST',
            }),
            { client: 'sqlite3' }
        );
        expect(result.statusCode).toBe(200);
    });

    it('routes close and delete requests to their controllers', async () => {
        await baseHandler(eventFor('/close'));
        await baseHandler(eventFor('/delete'));

        expect(closeController).toHaveBeenCalledTimes(1);
        expect(deleteController).toHaveBeenCalledTimes(1);
    });

    it('routes Agent close and move while preserving their original resource identity', async () => {
        await baseHandler(eventFor('/agent/close'));
        await baseHandler(eventFor('/agent/move'));

        expect(closeController).toHaveBeenCalledWith(
            expect.objectContaining({ resource: '/', originalResource: '/agent/close' }),
            { client: 'sqlite3' }
        );
        expect(moveController).toHaveBeenCalledWith(
            expect.objectContaining({ resource: '/', originalResource: '/agent/move' }),
            { client: 'sqlite3' }
        );
    });

    it('routes source-bound Agent move destination discovery', async () => {
        await baseHandler(eventFor('/agent/{id}/move-destinations', 'GET'));

        expect(destinationsController).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: '/',
                originalResource: '/agent/{id}/move-destinations',
                httpMethod: 'GET',
            }),
            { client: 'sqlite3' }
        );
    });

    it('returns 404 for unsupported routes', async () => {
        const result = await baseHandler(eventFor('/move', 'GET'));
        const body = JSON.parse(result.body);

        expect(result.statusCode).toBe(404);
        expect(body).toEqual({
            message: 'Not found',
            data: { code: '0x050004' },
            metadata: { request_id: 'unknown' },
        });
        expect(moveController).not.toHaveBeenCalled();
    });
});
