import { jest } from '@jest/globals';

const mockBatchWrite = jest.fn().mockResolvedValue(1);

jest.unstable_mockModule('../src/services/MetricsService.mjs', () => ({
    MetricsService: jest.fn().mockImplementation(() => ({
        batchWrite: mockBatchWrite,
    })),
}));

jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/lib-dynamodb', () => ({
    DeleteCommand: jest.fn(),
    DynamoDBDocumentClient: { from: jest.fn().mockReturnValue({}) },
    GetCommand: jest.fn(),
    PutCommand: jest.fn(),
    ScanCommand: jest.fn(),
}));

const { handler } = await import('../src/handler.mjs');
const { BAD_REQUEST_ERROR, GENERAL_INTERNAL_ERROR } = await import('@kace/error-codes');

const validPayload = {
    metrics: [
        {
            name: 'LCP',
            value: 2500,
            rating: 'good',
            delta: 2500,
            url: '/dashboard',
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
            appVersion: '1.10.6',
            connectionType: '4g',
            navigationType: 'navigate',
            timestamp: '2026-02-10T15:30:45.123Z',
        },
    ],
};

describe('Metrics Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockBatchWrite.mockResolvedValue(1);
    });

    it('should accept valid metrics and return 202', async () => {
        const event = { body: JSON.stringify(validPayload) };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(202);
        expect(body.data.accepted).toBe(1);
        expect(mockBatchWrite).toHaveBeenCalledWith(validPayload.metrics);
    });

    it('should handle pre-parsed body object', async () => {
        const event = { body: validPayload };

        const response = await handler(event);

        expect(response.statusCode).toBe(202);
        expect(mockBatchWrite).toHaveBeenCalledWith(validPayload.metrics);
    });

    it('should return 400 for missing metrics array', async () => {
        const event = { body: JSON.stringify({ data: [] }) };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(400);
        expect(body).toEqual({
            message: 'Bad request',
            data: { code: BAD_REQUEST_ERROR },
            metadata: { request_id: 'unknown' },
            errors: [{ code: BAD_REQUEST_ERROR, message: 'Bad request' }],
        });
        expect(mockBatchWrite).not.toHaveBeenCalled();
    });

    it('should return 400 for non-array metrics', async () => {
        const event = { body: JSON.stringify({ metrics: 'not-an-array' }) };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BAD_REQUEST_ERROR);
    });

    it('should return 400 for empty metrics array', async () => {
        const event = { body: JSON.stringify({ metrics: [] }) };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BAD_REQUEST_ERROR);
        expect(mockBatchWrite).not.toHaveBeenCalled();
    });

    it('should limit batch size to 50 metrics', async () => {
        const metrics = Array.from({ length: 100 }, (_, i) => ({
            ...validPayload.metrics[0],
            value: 2500 + i,
        }));
        const event = { body: JSON.stringify({ metrics }) };

        await handler(event);

        expect(mockBatchWrite).toHaveBeenCalledWith(expect.any(Array));
        expect(mockBatchWrite.mock.calls[0][0]).toHaveLength(50);
    });

    it('should return 400 for JSON parse errors', async () => {
        const event = { body: 'invalid json{{{' };

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body).data.code).toBe(BAD_REQUEST_ERROR);
    });

    it('should include CORS headers in all responses', async () => {
        const event = { body: JSON.stringify({ metrics: [] }) };

        const response = await handler(event);

        expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(response.headers['Content-Type']).toBe('application/json');
    });

    it('should return 500 when service throws', async () => {
        mockBatchWrite.mockRejectedValue(new Error('database password leaked'));
        const event = { body: JSON.stringify(validPayload) };

        const response = await handler(event);
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(500);
        expect(body.data.code).toBe(GENERAL_INTERNAL_ERROR);
        expect(response.body).not.toContain('database password leaked');
    });

    it('should return 400 for null body', async () => {
        const event = { body: null };

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
    });
});
