import {
    CsvExportViewExecutor,
    CsvExportViewManualExecutor,
    S3StorageService,
    CsvExportView,
    KnexCsvExportViewRepository,
    CsvExportViewExecutionService,
} from '../../src/csv-export-views/index.js';
import { knexConfig } from '../knexfile.js';
import CsvExportViewMother from './domain/CsvExportViewMother.js';

describe('CsvExportView Integration Tests', () => {
    const repository = new KnexCsvExportViewRepository(knexConfig);

    const mockS3StorageService = {
        uploadFile: (_filePath, destinationPath) => {
            return `s3://${process.env.AWS_S3_BUCKET}/${destinationPath}`;
        },
    };

    let csvExportView;

    const executionService = new CsvExportViewExecutionService({
        csvExportViewRepository: repository,
        s3StorageService: mockS3StorageService,
    });
    const executor = new CsvExportViewExecutor({
        executionService,
        csvExportViewRepository: repository,
    });
    const manualExecutor = new CsvExportViewManualExecutor({
        executionService,
        csvExportViewRepository: repository,
    });

    beforeEach(async () => {
        csvExportView = await CsvExportViewMother.create(repository, {
            frequency: 'days',
            interval: 1,
            views: ['test_view'],
            storage_path: 'test_exports',
            time_filter: {
                field: 'created_at',
                interval: 12,
                unit: 'hours',
                reference: 'now',
            },
        });
        await repository.connection.raw(`
            CREATE OR REPLACE VIEW test_view AS
            SELECT
              1 AS id,
              'Juan Pérez' AS name,
              'email@example.com' AS email,
              CURRENT_TIMESTAMP AS created_at,
              CURRENT_TIMESTAMP AS fecha,
              CURRENT_TIMESTAMP AS updated_at
            UNION ALL
            SELECT
              2 AS id,
              'Ana López' AS name,
              'ana@example.com' AS email,
              CURRENT_TIMESTAMP AS created_at,
              CURRENT_TIMESTAMP AS fecha,
              CURRENT_TIMESTAMP AS updated_at
            UNION ALL
            SELECT
              3 AS id,
              'Carlos Gómez' AS name,
              'carlos@example.com' AS email,
              CURRENT_TIMESTAMP AS created_at,
              CURRENT_TIMESTAMP AS fecha,
              CURRENT_TIMESTAMP AS updated_at;
          `);
    });

    afterEach(async () => {
        await repository.connection.raw('DROP VIEW IF EXISTS test_view');
    });

    it('should execute CsvExportViewExecutor and upload files to S3', async () => {
        const [result] = await executor.execute();

        expect(result.files).toEqual({
            test_view: {
                s3Location: result.files.test_view.s3Location,
                recordCount: 3,
            },
        });
        expect(result.processedViews).toBeDefined();
        expect(result.totalRecords).toBeDefined();
    });

    it('should execute CsvExportViewManualExecutor and upload files to S3', async () => {
        const result = await manualExecutor.execute(csvExportView.id.value);

        expect(result).toEqual({
            id: csvExportView.id.value,
            files: {
                test_view: {
                    s3Location: result.files.test_view.s3Location,
                    recordCount: 3,
                },
            },
            processedViews: ['test_view'],
            totalRecords: 3,
        });
    });

    it('should update CsvExportView execution data', async () => {
        await executor.execute();

        const updatedCsvExportView = await repository.find(csvExportView.id);

        expect(updatedCsvExportView.last_execution_at).not.toBeNull();
        expect(updatedCsvExportView.next_execution_at).not.toBeNull();
    });
});
