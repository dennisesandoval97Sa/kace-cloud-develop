import { ExportExcelData } from '../../../../src/shared/domain/services/ExportExcelData.js';
import { Criteria } from '../../../../src/shared/criteria/Criteria.js';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';
import { Ans, KnexAnsRepository } from '../../../../src/ans/index.js';
import AnsMother from '../../../ans/domain/AnsMother.js';
import { knexConfig } from '../../../knexfile.js';
import TestHelper from '../../../TestHelper.js';
import { jest } from '@jest/globals';

/**
 * Integration tests for ExportExcelData service.
 * These tests verify:
 * - Excel content generation from pre-fetched data rows
 * - Real S3 upload (requires AWS credentials in environment variables)
 * - Pre-signed URL generation
 *
 * IMPORTANT: These tests require AWS credentials to be set in environment variables:
 * - AWS_S3_REGION
 * - AWS_S3_ACCESS_KEY_ID
 * - AWS_S3_SECRET_ACCESS_KEY
 * - AWS_S3_BUCKET
 *
 * If these variables are not set, the tests will be skipped.
 */
// KACE-SKIP(decision-pendiente): los nueve tests suben un excel al bucket real de
// AWS_S3_BUCKET y firman una URL contra S3. Con AWS_S3_* en el .env escriben en el
// bucket de verdad; sin ellas el `if (!hasAWSCredentials) return` los deja en verde
// falso. Los mocks de tests/support/mocks/awsS3.js existen desde 0cc7a0ad4 sin usar.
describe.skip('ExportExcelData Integration Tests', () => {
    const repository = new KnexAnsRepository(knexConfig);
    let exportService;
    const tableName = 'ans';

    const hasAWSCredentials = !!(
        process.env.AWS_S3_REGION &&
        process.env.AWS_S3_ACCESS_KEY_ID &&
        process.env.AWS_S3_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET
    );

    beforeAll(async () => {
        if (!hasAWSCredentials) {
            console.warn(
                '⚠️  Skipping ExportExcelData integration tests: AWS credentials not found in environment variables'
            );
            console.warn('   Required: AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
            return;
        }

        const mockTenant = {
            aws_s3_region: { value: process.env.AWS_S3_REGION },
            aws_s3_access_key_id: { value: process.env.AWS_S3_ACCESS_KEY_ID },
            aws_s3_secret_access_key: { value: process.env.AWS_S3_SECRET_ACCESS_KEY },
            aws_s3_bucket: { value: process.env.AWS_S3_BUCKET },
            db_schema: { value: 'public' },
            apps_debug: { value: 'false' },
            apps_debug_level: { value: '1' },
        };

        jest.spyOn(TenantContext, 'getTenant').mockReturnValue(mockTenant);
    });

    beforeEach(async () => {
        if (!hasAWSCredentials) return;

        exportService = new ExportExcelData();
    });

    afterEach(async () => {});

    afterAll(async () => {
        if (!hasAWSCredentials) return;

        jest.restoreAllMocks();
    });

    it('should execute full export flow and return download URL', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        await AnsMother.createAns(repository);
        await AnsMother.createAns(repository);

        const criteria = new Criteria(null, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);

        const downloadUrl = await exportService.execute(rows, tableName);

        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
        expect(downloadUrl).toContain('X-Amz-Algorithm');
        expect(downloadUrl).toContain(process.env.AWS_S3_BUCKET);
    });

    it('should use custom headers when provided', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        await AnsMother.createAns(repository);

        const criteria = new Criteria(null, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);
        const customHeaders = ['id', 'intermedio', 'vencido'];
        const downloadUrl = await exportService.execute(rows, tableName, customHeaders);

        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
        expect(downloadUrl).toContain('X-Amz-Algorithm');
        expect(downloadUrl).toContain(process.env.AWS_S3_BUCKET);
    });

    it('should use custom file name when provided', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        await AnsMother.createAns(repository);

        const criteria = new Criteria(null, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);
        const customFileName = 'custom_ans_export';
        const downloadUrl = await exportService.execute(rows, customFileName);

        expect(downloadUrl).toContain(customFileName);
    });

    it('should handle empty result set', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        await expect(exportService.execute([], tableName)).rejects.toThrow('No data available to export');
    });

    it('should export data with filters applied', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        const ansDto1 = AnsMother.dto();
        ansDto1.intermedio = 5;
        await repository.save(new Ans(ansDto1));

        const ansDto2 = AnsMother.dto();
        ansDto2.intermedio = 15;
        await repository.save(new Ans(ansDto2));

        const ansDto3 = AnsMother.dto();
        ansDto3.intermedio = 25;
        await repository.save(new Ans(ansDto3));

        const filters = [
            {
                field: `${tableName}.intermedio`,
                operator: 'gt',
                value: 10,
                type: 'and',
            },
        ];
        const criteria = new Criteria(filters, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);

        expect(rows.length).toBeGreaterThanOrEqual(2);
        expect(rows.every((row) => row.intermedio > 10)).toBe(true);

        const downloadUrl = await exportService.execute(rows, `${tableName}_filtered`);
        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
    });

    it('should export data with complex criteria (multiple filters)', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        const ansDto1 = AnsMother.dto();
        ansDto1.intermedio = 10;
        await repository.save(new Ans(ansDto1));

        const ansDto2 = AnsMother.dto();
        ansDto2.intermedio = 20;
        await repository.save(new Ans(ansDto2));

        const ansDto3 = AnsMother.dto();
        ansDto3.intermedio = 30;
        await repository.save(new Ans(ansDto3));

        const ansDto4 = AnsMother.dto();
        ansDto4.intermedio = 40;
        await repository.save(new Ans(ansDto4));

        const filters = [
            {
                field: `${tableName}.intermedio`,
                operator: 'gte',
                value: 15,
                type: 'and',
            },
            {
                field: `${tableName}.intermedio`,
                operator: 'lte',
                value: 35,
                type: 'and',
            },
        ];
        const criteria = new Criteria(filters, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);

        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.intermedio >= 15 && row.intermedio <= 35)).toBe(true);

        const downloadUrl = await exportService.execute(rows, `${tableName}_complex`);
        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
    });

    it('should export data with ordering applied', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        const ansDto1 = AnsMother.dto();
        ansDto1.intermedio = 10;
        await repository.save(new Ans(ansDto1));

        const ansDto2 = AnsMother.dto();
        ansDto2.intermedio = 30;
        await repository.save(new Ans(ansDto2));

        const ansDto3 = AnsMother.dto();
        ansDto3.intermedio = 20;
        await repository.save(new Ans(ansDto3));

        const orders = [{ field: 'intermedio', direction: 'DESC' }];
        const criteria = new Criteria(null, null, 10, 0, orders, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);
        expect(rows[0].intermedio).toBeGreaterThanOrEqual(rows[1].intermedio);
        expect(rows[1].intermedio).toBeGreaterThanOrEqual(rows[2].intermedio);

        const downloadUrl = await exportService.execute(rows, `${tableName}_ordered`);
        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
    });

    it('should export with custom expiration time for pre-signed URL', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        await AnsMother.createAns(repository);

        const criteria = new Criteria(null, null, 10, 0, null, tableName);
        const rows = await repository.advancedSearch(criteria, tableName);
        const downloadUrl = await exportService.execute(rows, tableName, null, { expiresIn: 7200 });

        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
        expect(downloadUrl).toContain('X-Amz-Expires=7200');
    });

    it('should handle objects and dates in data correctly', async () => {
        if (!hasAWSCredentials) {
            return;
        }

        const mockRows = [
            {
                id: 1,
                name: 'Test User',
                email: 'test@example.com',
                created_at: new Date('2024-01-01T00:00:00Z'),
                metadata: { key: 'value', nested: { data: 123 } },
                count: 42,
            },
            {
                id: 2,
                name: 'Another User',
                email: 'another@example.com',
                created_at: new Date('2024-01-02T00:00:00Z'),
                metadata: { status: 'active' },
                count: 100,
            },
        ];

        const downloadUrl = await exportService.execute(mockRows, 'mixed_types_export');

        expect(downloadUrl).toBeDefined();
        expect(downloadUrl).toContain('https://');
        expect(downloadUrl).toContain('mixed_types_export');
    });
});
