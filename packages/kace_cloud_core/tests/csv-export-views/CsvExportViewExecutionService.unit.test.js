import { jest } from '@jest/globals';
import { CsvExportViewExecutionService } from '../../src/csv-export-views/domain/CsvExportViewExecutionService.js';
import { CsvGenerator } from '../../src/csv-export-views/infrastructure/CsvGenerator.js';
import createDayjsInstance from '../../src/shared/factories/DayjsFactory.js';

// Misma instancia (misma zona horaria por defecto) que la que usa el servicio bajo prueba.
const dayjs = createDayjsInstance({});

// This service takes its repository and S3 storage collaborators via dependency injection, so
// they are faked with plain objects here instead of going through a real DB or a real S3Client —
// consistent with CsvExportViewService.integration.test.js, which fakes `s3StorageService` the
// same way while still using a real repository/DB for its own (integration-level) scenarios.
// These are duck-typed CsvExportView-like objects, not real entities, precisely so branches that
// are unreachable through the real entity's validated value objects (e.g. an empty storage_path)
// can still be exercised directly.
const fakeView = (overrides = {}) => ({
    frequency: { value: 'days' },
    interval: { value: 1 },
    views: { value: ['view1'] },
    storage_path: { value: 'reports' },
    details: { value: null },
    time_filter: { field: 'created_at' },
    ...overrides,
});

const fakeRepository = (overrides = {}) => ({
    update: jest.fn().mockResolvedValue(undefined),
    fetchViewData: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    ...overrides,
});

const fakeS3StorageService = (uploadFileImpl) => ({
    uploadFile: jest.fn(uploadFileImpl ?? (async (_filePath, destinationPath) => `s3://bucket/${destinationPath}`)),
});

describe('CsvExportViewExecutionService', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('calculateNextExecution', () => {
        it('uses "now" as the default currentDate when none is given', () => {
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: fakeS3StorageService(),
            });
            const before = Date.now();

            const result = service.calculateNextExecution(fakeView());

            const resultMs = result.toDate().getTime();
            // frequency=days, interval=1 => ~"now" + 1 day, rounded down to the hour first. Allow a
            // 2h window either side to absorb the hour truncation and test execution time.
            expect(resultMs).toBeGreaterThan(before + 22 * 60 * 60 * 1000);
            expect(resultMs).toBeLessThan(before + 26 * 60 * 60 * 1000);
        });

        it('returns null and logs when frequency is missing', () => {
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: fakeS3StorageService(),
            });

            const result = service.calculateNextExecution(fakeView({ frequency: { value: null } }));

            expect(result).toBeNull();
        });

        it('returns null and logs when interval is missing', () => {
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: fakeS3StorageService(),
            });

            const result = service.calculateNextExecution(fakeView({ interval: { value: 0 } }));

            expect(result).toBeNull();
        });

        it('returns null for a frequency value with no hours/days/weeks/months mapping', () => {
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: fakeS3StorageService(),
            });

            const result = service.calculateNextExecution(fakeView({ frequency: { value: 'fortnights' } }));

            expect(result).toBeNull();
        });
    });

    describe('execute', () => {
        it('builds the destination path without a double slash when storage_path is empty', async () => {
            const s3 = fakeS3StorageService();
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: s3,
            });

            await service.execute(fakeView({ storage_path: { value: '' } }), true);

            expect(s3.uploadFile).toHaveBeenCalledTimes(1);
            const [, destinationPath] = s3.uploadFile.mock.calls[0];
            expect(destinationPath).toMatch(/^reporting\/\d{8}_\d{6}_view1\.csv$/);
        });

        it('keeps the storage_path segment (with trailing slash) in the destination path when present', async () => {
            const s3 = fakeS3StorageService();
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: s3,
            });

            await service.execute(fakeView({ storage_path: { value: 'exports/2026' } }), true);

            const [, destinationPath] = s3.uploadFile.mock.calls[0];
            expect(destinationPath).toMatch(/^reporting\/exports\/2026\/\d{8}_\d{6}_view1\.csv$/);
        });

        it('records s3Location, recordCount, and totalRecords in the result on a successful upload', async () => {
            const s3 = fakeS3StorageService();
            const repository = fakeRepository({
                fetchViewData: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
            });
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: repository,
                s3StorageService: s3,
            });

            const result = await service.execute(fakeView(), true);

            expect(s3.uploadFile).toHaveBeenCalledTimes(1);
            // s3Location is the destinationPath the service itself built and passed to
            // uploadFile (the value uploadFile *resolves to* is discarded by production code),
            // so cross-checking against the captured call arg — rather than recomputing the
            // expected string a second time — pins down the actual value stored in the result,
            // not just that "some" upload happened.
            const [, destinationPath] = s3.uploadFile.mock.calls[0];
            expect(result.files.view1).toEqual({ s3Location: destinationPath, recordCount: 3 });
            expect(result.totalRecords).toBe(3);
        });

        it('marks a view as failed (recordCount 0) and skips the upload when the CSV file was not generated', async () => {
            jest.spyOn(CsvGenerator.prototype, 'generate').mockReturnValueOnce(null);
            const s3 = fakeS3StorageService();
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: s3,
            });

            const result = await service.execute(fakeView(), true);

            expect(result.files.view1).toEqual({
                error: 'Error while querying the view: File was not generated',
                recordCount: 0,
            });
            expect(result.totalRecords).toBe(0);
            expect(s3.uploadFile).not.toHaveBeenCalled();
        });

        it('updates last/next execution and calls repository.update when isManual is false', async () => {
            // Solo se congela el reloj (Date); los temporizadores reales se dejan intactos porque
            // `execute` hace I/O (CsvGenerator escribe el fichero temporal) dentro de un Promise.all.
            const fixedNow = new Date('2026-03-15T13:37:42.000Z');
            jest.useFakeTimers({
                now: fixedNow,
                doNotFake: [
                    'nextTick',
                    'queueMicrotask',
                    'setTimeout',
                    'clearTimeout',
                    'setInterval',
                    'clearInterval',
                    'setImmediate',
                    'clearImmediate',
                    'performance',
                    'hrtime',
                ],
            });

            try {
                const repository = fakeRepository();
                const service = new CsvExportViewExecutionService({
                    csvExportViewRepository: repository,
                    s3StorageService: fakeS3StorageService(),
                });
                const view = fakeView();

                await service.execute(view, false);

                expect(repository.update).toHaveBeenCalledTimes(1);
                expect(repository.update).toHaveBeenCalledWith(view);

                // Valores EXACTOS: `expect.any(String)` dejaba pasar cualquier marca de tiempo,
                // incluso una que descartase el resultado de `calculateNextExecution` (la
                // planificacion nunca avanzaria). frequency=days, interval=1 => +1 dia sobre la
                // hora en curso truncada.
                const expectedLast = dayjs(fixedNow).startOf('hour');
                const expectedNext = expectedLast.add(1, 'day');
                expect(view.last_execution_at).toBe(expectedLast.toISOString());
                expect(view.next_execution_at).toBe(expectedNext.toISOString());
                expect(view.next_execution_at).toBe(
                    service.calculateNextExecution(view, dayjs(fixedNow)).toISOString()
                );
            } finally {
                jest.useRealTimers();
            }
        });

        it('does NOT touch last/next execution or call repository.update when isManual is true', async () => {
            const repository = fakeRepository();
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: repository,
                s3StorageService: fakeS3StorageService(),
            });
            const view = fakeView();

            await service.execute(view, true);

            expect(repository.update).not.toHaveBeenCalled();
            expect(view.last_execution_at).toBeUndefined();
            expect(view.next_execution_at).toBeUndefined();
        });

        it('computes currentDate from a string filterDate (end of that day) and echoes it back as result.filterDate', async () => {
            const repository = fakeRepository();
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: repository,
                s3StorageService: fakeS3StorageService(),
            });

            const result = await service.execute(fakeView(), true, '2026-03-15');

            expect(result.filterDate).toBe('2026-03-15');
            expect(repository.fetchViewData).toHaveBeenCalledWith(
                'view1',
                expect.objectContaining({ field: 'created_at' }),
                '2026-03-15'
            );
        });

        it('omits result.filterDate when no filterDate is given', async () => {
            const service = new CsvExportViewExecutionService({
                csvExportViewRepository: fakeRepository(),
                s3StorageService: fakeS3StorageService(),
            });

            const result = await service.execute(fakeView(), true);

            expect(result).not.toHaveProperty('filterDate');
        });
    });
});
