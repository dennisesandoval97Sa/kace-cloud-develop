import { jest } from '@jest/globals';
import { MetricsService } from '../../src/services/MetricsService.mjs';

const validMetric = {
    name: 'LCP',
    value: 2500,
    rating: 'good',
    delta: 2500,
    url: '/dashboard',
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    appVersion: '1.10.6',
    connectionType: '4g',
    navigationType: 'navigate',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: '2026-02-10T15:30:45.123Z',
};

describe('MetricsService', () => {
    let mockSend;
    let service;

    beforeEach(() => {
        mockSend = jest.fn().mockResolvedValue({});
        const mockDocClient = { send: mockSend };
        service = new MetricsService(mockDocClient, 'test-table', 90);
    });

    describe('batchWrite', () => {
        it('should write valid metrics to DynamoDB', async () => {
            const result = await service.batchWrite([validMetric]);

            expect(result).toBe(1);
            expect(mockSend).toHaveBeenCalledTimes(1);

            const command = mockSend.mock.calls[0][0];
            const items = command.input.RequestItems['test-table'];
            expect(items).toHaveLength(1);

            const item = items[0].PutRequest.Item;
            expect(item.date).toBe('2026-02-10');
            expect(item.timestamp).toContain('2026-02-10T15:30:45.123Z#');
            expect(item.name).toBe('LCP');
            expect(item.value).toBe(2500);
            expect(item.rating).toBe('good');
            expect(item.ttl).toBeGreaterThan(0);
        });

        it('should filter out invalid metrics', async () => {
            const invalid = { name: 'INVALID', value: 2500, rating: 'good', url: '/test' };
            const result = await service.batchWrite([invalid, validMetric]);

            expect(result).toBe(1);
            const items = mockSend.mock.calls[0][0].input.RequestItems['test-table'];
            expect(items).toHaveLength(1);
        });

        it('should return 0 for empty array', async () => {
            const result = await service.batchWrite([]);

            expect(result).toBe(0);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('should return 0 when all metrics are invalid', async () => {
            const result = await service.batchWrite([{ bad: 'data' }, { missing: 'fields' }]);

            expect(result).toBe(0);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('should chunk metrics into batches of 25', async () => {
            const metrics = Array.from({ length: 50 }, () => ({ ...validMetric }));

            await service.batchWrite(metrics);

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(mockSend.mock.calls[0][0].input.RequestItems['test-table']).toHaveLength(25);
            expect(mockSend.mock.calls[1][0].input.RequestItems['test-table']).toHaveLength(25);
        });

        it('should truncate userAgent to 256 characters', async () => {
            const metric = { ...validMetric, userAgent: 'A'.repeat(500) };

            await service.batchWrite([metric]);

            const item = mockSend.mock.calls[0][0].input.RequestItems['test-table'][0].PutRequest.Item;
            expect(item.userAgent).toHaveLength(256);
        });

        it('should continue processing chunks when one fails', async () => {
            mockSend.mockRejectedValueOnce(new Error('DynamoDB error')).mockResolvedValueOnce({});

            const metrics = Array.from({ length: 50 }, () => ({ ...validMetric }));
            const result = await service.batchWrite(metrics);

            expect(result).toBe(25);
            expect(mockSend).toHaveBeenCalledTimes(2);
        });

        it('should generate unique sort keys for duplicate timestamps', async () => {
            const metrics = [{ ...validMetric }, { ...validMetric }];

            await service.batchWrite(metrics);

            const items = mockSend.mock.calls[0][0].input.RequestItems['test-table'];
            const ts1 = items[0].PutRequest.Item.timestamp;
            const ts2 = items[1].PutRequest.Item.timestamp;
            expect(ts1).not.toBe(ts2);
            expect(ts1).toContain('2026-02-10T15:30:45.123Z#');
            expect(ts2).toContain('2026-02-10T15:30:45.123Z#');
        });

        it('should strip unknown fields from metrics', async () => {
            const metric = { ...validMetric, unknownField: 'should-be-stripped', anotherField: 123 };

            await service.batchWrite([metric]);

            const item = mockSend.mock.calls[0][0].input.RequestItems['test-table'][0].PutRequest.Item;
            expect(item.unknownField).toBeUndefined();
            expect(item.anotherField).toBeUndefined();
        });

        it('should validate all accepted metric names', async () => {
            const names = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'FCP'];
            const metrics = names.map((name) => ({ ...validMetric, name }));

            const result = await service.batchWrite(metrics);

            expect(result).toBe(6);
        });

        it('should validate rating values', async () => {
            const ratings = ['good', 'needs-improvement', 'poor'];
            const metrics = ratings.map((rating) => ({ ...validMetric, rating }));

            const result = await service.batchWrite(metrics);

            expect(result).toBe(3);
        });

        it('should handle missing optional fields', async () => {
            const { delta, navigationType, userAgent, ...minimal } = validMetric;

            const result = await service.batchWrite([minimal]);

            expect(result).toBe(1);
            const item = mockSend.mock.calls[0][0].input.RequestItems['test-table'][0].PutRequest.Item;
            expect(item.connectionType).toBe('4g');
        });

        it('should default connectionType to unknown', async () => {
            const { connectionType, ...metric } = validMetric;

            await service.batchWrite([metric]);

            const item = mockSend.mock.calls[0][0].input.RequestItems['test-table'][0].PutRequest.Item;
            expect(item.connectionType).toBe('unknown');
        });
    });
});
