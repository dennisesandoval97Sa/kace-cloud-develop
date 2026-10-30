import { jest } from '@jest/globals';
import { CsvExportViewManualExecutor } from '../../../../src/csv-export-views/application/execute/CsvExportViewManualExecutor.js';

// The finder used internally builds `new ValueObjectUuid('id', id)` before delegating to
// `repository.find(...)`, so the ids used here must be well-formed UUIDs. The repository itself
// is a duck-typed fake, controlling the finder's result without touching a real DB or S3.
const fakeRepository = (findResult) => ({
    find: jest.fn().mockResolvedValue(findResult),
});

const MISSING_ID = '00000000-0000-4000-8000-000000000001';
const INACTIVE_ID = '00000000-0000-4000-8000-000000000002';
const ACTIVE_ID = '00000000-0000-4000-8000-000000000003';

describe('CsvExportViewManualExecutor', () => {
    it('throws a 404 CustomError when no CsvExportView is found for the given id', async () => {
        const executor = new CsvExportViewManualExecutor({
            executionService: { execute: jest.fn() },
            csvExportViewRepository: fakeRepository(null),
        });

        await expect(executor.execute(MISSING_ID)).rejects.toMatchObject({
            message: 'CsvExportView not found',
            statusCode: 404,
        });
    });

    it('throws a 400 CustomError when the CsvExportView is found but not active', async () => {
        const inactiveView = { isDeleted: () => false, isActive: () => false };
        const executor = new CsvExportViewManualExecutor({
            executionService: { execute: jest.fn() },
            csvExportViewRepository: fakeRepository(inactiveView),
        });

        await expect(executor.execute(INACTIVE_ID)).rejects.toMatchObject({
            message: 'CsvExportView is not active',
            statusCode: 400,
        });
    });

    it('runs the execution service and prefixes the result with the given id when active', async () => {
        const activeView = { isDeleted: () => false, isActive: () => true };
        const executionService = { execute: jest.fn().mockResolvedValue({ totalRecords: 5 }) };
        const executor = new CsvExportViewManualExecutor({
            executionService,
            csvExportViewRepository: fakeRepository(activeView),
        });

        const result = await executor.execute(ACTIVE_ID, '2026-01-01');

        expect(executionService.execute).toHaveBeenCalledWith(activeView, true, '2026-01-01');
        expect(result).toEqual({ id: ACTIVE_ID, totalRecords: 5 });
    });
});
