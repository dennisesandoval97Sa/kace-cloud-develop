import { jest } from '@jest/globals';
import { CsvExportViewExecutor } from '../../../../src/csv-export-views/application/execute/CsvExportViewExecutor.js';

describe('CsvExportViewExecutor', () => {
    it('skips inactive pending exports and only runs the execution service for active ones', async () => {
        const activeView = { id: { value: 'active-1' }, isActive: () => true };
        const inactiveView = { id: { value: 'inactive-1' }, isActive: () => false };
        const repository = {
            findByNextExecutionAt: jest.fn().mockResolvedValue([inactiveView, activeView]),
        };
        const executionService = { execute: jest.fn().mockResolvedValue({ totalRecords: 2 }) };
        const executor = new CsvExportViewExecutor({ executionService, csvExportViewRepository: repository });

        const results = await executor.execute();

        expect(executionService.execute).toHaveBeenCalledTimes(1);
        expect(executionService.execute).toHaveBeenCalledWith(activeView);
        expect(results).toEqual([{ id: 'active-1', totalRecords: 2 }]);
    });

    it('returns an empty array when there are no pending exports', async () => {
        const repository = { findByNextExecutionAt: jest.fn().mockResolvedValue([]) };
        const executionService = { execute: jest.fn() };
        const executor = new CsvExportViewExecutor({ executionService, csvExportViewRepository: repository });

        const results = await executor.execute();

        expect(results).toEqual([]);
        expect(executionService.execute).not.toHaveBeenCalled();
    });
});
