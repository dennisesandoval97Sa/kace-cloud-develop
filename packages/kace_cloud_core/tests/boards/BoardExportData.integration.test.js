import { BoardExportData } from '../../src/boards/application/export/BoardExportData.js';
import { ExportExcelData } from '../../src/shared/domain/services/ExportExcelData.js';
import { KnexBoardResourcesRepository } from '../../src/boards/infrastructure/persistence/KnexBoardResourcesRepository.js';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { jest } from '@jest/globals';
import CasesMother from '../cases/domain/CasesMother.js';
import dayjs from 'dayjs';

/**
 * Integration tests for BoardExportData service.
 * These tests verify:
 * - Board creation and data querying
 * - Export of board resources with filters, relationships, and aggregations
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
// KACE-SKIP(decision-pendiente): los doce tests suben un excel al bucket real de
// AWS_S3_BUCKET y firman una URL contra S3. Con AWS_S3_* en el .env escriben en el
// bucket de verdad; sin ellas el `if (!hasAWSCredentials) return` los deja en verde
// falso. Los mocks de tests/support/mocks/awsS3.js existen desde 0cc7a0ad4 sin usar.
describe.skip('BoardExportData Integration Tests', () => {
    const boardsRepository = new KnexBoardsRepository(knexConfig);
    const boardResourcesRepository = new KnexBoardResourcesRepository(boardsRepository.connection);
    const casesRepository = new KnexCaseRepository(boardsRepository.connection);

    let exportService;

    // Check if AWS credentials are available
    const hasAWSCredentials = !!(
        process.env.AWS_S3_REGION &&
        process.env.AWS_S3_ACCESS_KEY_ID &&
        process.env.AWS_S3_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET
    );

    beforeAll(async () => {
        if (!hasAWSCredentials) {
            console.warn(
                '⚠️  Skipping BoardExportData integration tests: AWS credentials not found in environment variables'
            );
            console.warn('   Required: AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, AWS_S3_BUCKET');
            return;
        }

        // Setup test tenant context with real AWS credentials
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

        // Initialize export service with casos table (most common use case)
        exportService = new BoardExportData(boardResourcesRepository, 'cases', new ExportExcelData());
    });

    afterEach(async () => {});

    afterAll(async () => {
        if (!hasAWSCredentials) return;

        jest.restoreAllMocks();
    });

    it('should export board data with basic criteria', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'external_code', function: null, group_by: false },
                { entity: 'cases', field: 'created_at', alias: 'fecha_creacion', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria);

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('X-Amz-Algorithm');
        expect(result.data.downloadUrl).toContain(process.env.AWS_S3_BUCKET);
        expect(result.data.downloadUrl).toContain('cases_export');
    });

    it('should export board data with basic criteria (no filters)', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'external_code', function: null, group_by: false },
                { entity: 'cases', field: 'created_at', alias: 'fecha_creacion', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria);

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('X-Amz-Algorithm');
        expect(result.data.downloadUrl).toContain(process.env.AWS_S3_BUCKET);
        expect(result.data.downloadUrl).toContain('cases_export');
    });

    it('should export board data with filters applied', async () => {
        if (!hasAWSCredentials) return;

        const caso1 = await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [
                {
                    type: 'and',
                    entity: 'cases',
                    field: 'id',
                    operator: 'eq',
                    value: caso1.id.value,
                },
            ],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'external_code', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, { fileName: 'casos_filtrados' });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('casos_filtrados');
    });

    it('should export board data with relationships (JOINs)', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [
                {
                    alias: 'usuario',
                    related_entity: 'usuarios',
                    join_type: 'left',
                    on: [
                        {
                            left: 'cases.responsable_id',
                            right: 'usuario.id',
                        },
                    ],
                    relations: [],
                },
            ],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'caso_id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'caso_codigo', function: null, group_by: false },
                { entity: 'usuario', field: 'nombres', alias: 'usuario_nombres', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, { fileName: 'casos_con_usuarios' });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('casos_con_usuarios');
    });

    it('should export board data with aggregate functions', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);
        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'responsable_id', alias: 'responsable_id', function: null, group_by: true },
                { entity: 'cases', field: 'id', alias: 'total_casos', function: 'count', group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, { fileName: 'casos_por_responsable' });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('casos_por_responsable');
    });

    it('should export board data with ordering', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository, {
            created_at: dayjs().subtract(3, 'days').toDate(),
        });
        await CasesMother.createCaseWithRelations(casesRepository, {
            created_at: dayjs().subtract(1, 'day').toDate(),
        });
        await CasesMother.createCaseWithRelations(casesRepository, {
            created_at: dayjs().toDate(),
        });

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: [{ field: 'created_at', direction: 'DESC' }],
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'external_code', function: null, group_by: false },
                { entity: 'cases', field: 'created_at', alias: 'fecha_creacion', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, { fileName: 'casos_ordenados' });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('casos_ordenados');
    });

    it('should throw ValidationFailError when no data matches criteria', async () => {
        if (!hasAWSCredentials) return;

        const dtoCriteria = {
            filter: [
                {
                    type: 'and',
                    entity: 'cases',
                    field: 'id',
                    operator: 'eq',
                    value: '00000000-0000-0000-0000-000000000000',
                },
            ],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false }],
            having: [],
            subQuery: false,
        };

        await expect(exportService.execute(dtoCriteria)).rejects.toThrow(
            'No se encontraron registros en "cases" que coincidan con el criterio de búsqueda.'
        );
    });

    it('should export all data ignoring pagination (limit and offset)', async () => {
        if (!hasAWSCredentials) return;

        for (let i = 0; i < 5; i++) {
            await CasesMother.createCaseWithRelations(casesRepository);
        }

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 2, // Should be ignored
            offset: 1, // Should be ignored
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'external_code', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria);

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
    });

    it('should use custom file name when provided in options', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [{ entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false }],
            having: [],
            subQuery: false,
        };

        const customFileName = 'mi_exportacion_personalizada';
        const result = await exportService.execute(dtoCriteria, { fileName: customFileName });

        expect(result.data.downloadUrl).toContain(customFileName);
    });

    it('should extract headers from select column aliases', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'ID del Caso', function: null, group_by: false },
                { entity: 'cases', field: 'external_code', alias: 'Código', function: null, group_by: false },
                { entity: 'cases', field: 'created_at', alias: 'Fecha de Creación', function: null, group_by: false },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, { fileName: 'casos_con_aliases' });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('casos_con_aliases');
    });

    it('should format rows without mutating boardResources.rows (readonly)', async () => {
        if (!hasAWSCredentials) return;

        await CasesMother.createCaseWithRelations(casesRepository);

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                {
                    entity: 'cases',
                    field: 'created_at',
                    alias: 'fecha_creacion',
                    function: null,
                    group_by: false,
                    data_type: 'DATE',
                },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, {
            fileName: 'test_readonly_rows',
        });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('test_readonly_rows');
    });

    it('should format DATE fields using DateFormatter (real export validation)', async () => {
        if (!hasAWSCredentials) return;

        const fixedDate = new Date('2026-03-25T15:00:00Z');

        await CasesMother.createCaseWithRelations(casesRepository, {
            created_at: fixedDate,
        });

        const dtoCriteria = {
            filter: [],
            relationship: [],
            limit: 10,
            offset: 0,
            orders: null,
            tableName: 'cases',
            select: [
                { entity: 'cases', field: 'id', alias: 'id', function: null, group_by: false },
                {
                    entity: 'cases',
                    field: 'created_at',
                    alias: 'fecha_creacion',
                    function: null,
                    group_by: false,
                    data_type: 'DATE',
                    format: 'YYYY/MM/DD HH:MM:SS',
                },
            ],
            having: [],
            subQuery: false,
        };

        const result = await exportService.execute(dtoCriteria, {
            fileName: 'test_date_format_real',
        });

        expect(result.data.downloadUrl).toBeDefined();
        expect(result.data.downloadUrl).toContain('https://');
        expect(result.data.downloadUrl).toContain('test_date_format_real');
    });
});
