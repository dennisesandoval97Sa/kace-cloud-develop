import { ReportCreator } from '../../src/reports/application/create/ReportCreator.js';
import { ReportDistinctValuesFinder, KnexReportsViewRepository } from '../../src/reports/index.js';
import ExcelExporter from '../../src/reports/infrastructure/services/ExcelExporter.js';
import { knexConfig } from '../knexfile.js';
import { jest } from '@jest/globals';

describe('ReportCreator Integration Test', () => {
    const repository = new KnexReportsViewRepository(knexConfig);
    const excelExporter = new ExcelExporter({ sheetName: 'TestSheet', creator: 'integration-test' });

    const mockS3StorageService = {
        uploadStream: jest.fn(async (stream, destinationPath) => {
            // Drain the stream so the excel writer on the other end never blocks on backpressure.
            for await (const _chunk of stream) {
                // no-op: mock upload does not need the bytes
            }
            return `s3://${process.env.AWS_S3_BUCKET || 'test-bucket'}/${destinationPath}`;
        }),
    };

    const reportCreator = new ReportCreator({
        reportViewRepository: repository,
        excelExporter,
        s3StorageService: mockS3StorageService,
    });

    /**
     * Los `::timestamp` son parte del caso de prueba, no adorno. Sin ellos las
     * columnas de la vista quedan `text` -los literales sin tipo de un UNION se
     * resuelven a text- y postgres compara las fechas como cadenas. Los limites
     * que construye `KnexReportsViewRepository` son ISO
     * (`2025-12-01T00:00:00.000Z`), asi que en la fila cuya fecha cae justo en el
     * dia del limite decide el caracter 11: ' ' (0x20) < 'T' (0x54), y el
     * registro del 1 de diciembre se caia de TODOS los informes. Las vistas
     * reales de reportes tienen columnas timestamp; esta las imita.
     */
    beforeEach(async () => {
        await repository.connection.raw(`
                        CREATE OR REPLACE VIEW reports_vista_test AS
                        SELECT
                            1 AS id,
                            'Test Case 1' AS name,
                            '2025-12-01 10:00:00'::timestamp AS created_at,
                            '2025-12-15 14:30:00'::timestamp AS fecha_resolucion,
                            'active' AS status
                        UNION ALL
                        SELECT
                            2 AS id,
                            'Test Case 2' AS name,
                            '2025-12-05 11:00:00'::timestamp AS created_at,
                            NULL::timestamp AS fecha_resolucion,
                            'pending' AS status
                        UNION ALL
                        SELECT
                            3 AS id,
                            'Test Case 3' AS name,
                            '2025-12-10 12:00:00'::timestamp AS created_at,
                            '2025-12-20 16:00:00'::timestamp AS fecha_resolucion,
                            'active' AS status
                        UNION ALL
                        SELECT
                            4 AS id,
                            'Test Case 4' AS name,
                            '2025-12-25 13:00:00'::timestamp AS created_at,
                            '2025-12-30 17:00:00'::timestamp AS fecha_resolucion,
                            'active' AS status;
                `);
    });

    afterEach(async () => {
        await repository.connection.raw('DROP VIEW IF EXISTS reports_vista_test');
        jest.clearAllMocks();
    });

    it('should generate a report with period filter and conditions', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-31',
            },
            conditions: [
                {
                    field: 'fecha_resolucion',
                    operator: 'notNull',
                    value: null,
                    type: 'AND',
                },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.presignedUrl).toBeDefined();
        expect(result.recordCount).toBeGreaterThan(0);
        expect(mockS3StorageService.uploadStream).toHaveBeenCalled();

        expect(result.recordCount).toBe(3);
    });

    it('should generate a report with only period filter', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-15',
            },
            conditions: [],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.recordCount).toBeGreaterThan(0);

        expect(result.recordCount).toBe(3);
    });

    it('should generate a report with multiple conditions', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-31',
            },
            conditions: [
                {
                    field: 'fecha_resolucion',
                    operator: 'notNull',
                    value: null,
                    type: 'AND',
                },
                {
                    field: 'status',
                    operator: 'equals',
                    value: 'active',
                    type: 'AND',
                },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.recordCount).toBeGreaterThan(0);

        expect(result.recordCount).toBe(3);
    });

    it('should filter with IN operator using array of values', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-31',
            },
            conditions: [
                {
                    field: 'status',
                    operator: 'in',
                    value: ['active'],
                    type: 'AND',
                },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.recordCount).toBe(3);
    });

    it('should filter with notIn operator using array of values', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-31',
            },
            conditions: [
                {
                    field: 'status',
                    operator: 'notIn',
                    value: ['pending'],
                    type: 'AND',
                },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.recordCount).toBe(3);
    });

    it('should return distinct values for a field via repository', async () => {
        const { values, total } = await repository.getDistinctFieldValues('reports_vista_test', 'status');

        expect(values).toHaveLength(2);
        expect(total).toBe(2);
        expect(values).toEqual(expect.arrayContaining(['active', 'pending']));
    });

    it('should return formatted distinct values via ReportDistinctValuesFinder', async () => {
        const finder = new ReportDistinctValuesFinder(repository);
        const { items, total } = await finder.execute('reports_vista_test', 'status');

        expect(items).toHaveLength(2);
        expect(total).toBe(2);
        expect(items[0]).toMatchObject({
            id: expect.anything(),
            label: expect.any(String),
            value: expect.anything(),
        });
        expect(items.map((r) => r.value)).toEqual(expect.arrayContaining(['active', 'pending']));
    });

    it('should filter correctly when period dates include UTC timezone (Z suffix)', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initialDate: '2025-12-01T00:00:00.000Z',
                endDate: '2025-12-15T23:59:59.999Z',
            },
            conditions: [],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        // Records 1 (Dec 01 10:00), 2 (Dec 05 11:00), 3 (Dec 10 12:00) fall within the range.
        // Record 4 (Dec 25 13:00) is outside the range.
        expect(result.recordCount).toBe(3);
    });

    it('should convert non-UTC timezone offset to UTC before filtering', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initialDate: '2025-12-05T06:00:00-05:00',
                endDate: '2025-12-10T07:00:00-05:00',
            },
            conditions: [],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        // After UTC conversion the window is [2025-12-05 11:00:00, 2025-12-10 12:00:00].
        // Record 2 (Dec 05 11:00:00) and Record 3 (Dec 10 12:00:00) fall exactly on the boundaries.
        // Records 1 (Dec 01) and 4 (Dec 25) are outside.
        expect(result.recordCount).toBe(2);
    });

    it('should generate a report with OR conditions', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: {
                field: 'created_at',
                initial_date: '2025-12-01',
                end_date: '2025-12-31',
            },
            conditions: [
                {
                    field: 'status',
                    operator: 'equals',
                    value: 'pending',
                    type: 'OR',
                },
                {
                    field: 'id',
                    operator: 'equals',
                    value: 3,
                    type: 'OR',
                },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result).toBeDefined();
        expect(result.recordCount).toBeGreaterThan(0);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with null (es nulo) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'fecha_resolucion', operator: 'null', value: null, type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with gt (mayor que) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'gt', value: 2, type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with lt (menor que) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'lt', value: 3, type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with neq (diferente de) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'status', operator: 'neq', value: 'active', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with gte (mayor o igual que) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'gte', value: 3, type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with lte (menor o igual que) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'lte', value: 2, type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with like (contiene) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'name', operator: 'like', value: 'Case 1', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with ilike (contiene sin mayusculas) operator', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'name', operator: 'ilike', value: 'case 1', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    // Regresión: KnexReportsViewRepository#buildFilteredQuery referenciaba `isSQLite` sin
    // declarar dentro de la rama OR de `ilike` (quedó huérfana al borrar el `const isSQLite`
    // del bloque AND durante la limpieza de ramas muertas de sqlite). Ejercita directamente
    // fetchViewDataWithConditions (sin pasar por ReportCreator/Excel) y afirma qué filas
    // concretas devuelve, no solo que la llamada no lanzó.
    it('should filter with ilike operator combined via OR and return the exact matching rows', async () => {
        const rows = await repository.fetchViewDataWithConditions('reports_vista_test', null, [
            { field: 'name', operator: 'ilike', value: 'case 2', type: 'OR' },
            { field: 'id', operator: 'equals', value: 4, type: 'OR' },
        ]);

        expect(rows.map((row) => row.id).sort()).toEqual([2, 4]);
        expect(rows.find((row) => row.id === 2).name).toBe('Test Case 2');
        expect(rows.find((row) => row.id === 4).name).toBe('Test Case 4');
    });

    it('should filter with between (entre) operator using array', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'between', value: [2, 3], type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with between operator using comma-separated string', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'id', operator: 'between', value: '1,2', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with gt (mayor que) on date string — normalizes to end of day', async () => {
        // gt '2025-12-10' → > '2025-12-10 23:59:59' → only Record 4 (Dec 25)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'gt', value: '2025-12-10', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with gte (mayor o igual que) on date string — normalizes to start of day', async () => {
        // gte '2025-12-10' → >= '2025-12-10 00:00:00' → Record 3 (Dec 10 12:00) + Record 4 (Dec 25)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'gte', value: '2025-12-10', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with lt (menor que) on date string — normalizes to start of day', async () => {
        // lt '2025-12-05' → < '2025-12-05 00:00:00' → only Record 1 (Dec 01 10:00)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'lt', value: '2025-12-05', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with lte (menor o igual que) on date string — normalizes to end of day', async () => {
        // lte '2025-12-05' → <= '2025-12-05 23:59:59' → Record 1 (Dec 01) + Record 2 (Dec 05 11:00)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'lte', value: '2025-12-05', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with gt on ISO datetime string with timezone (Z) — uses exact timestamp', async () => {
        // gt '2025-12-10T12:00:00.000Z' → > '2025-12-10 12:00:00' → only Record 4 (Dec 25 13:00)
        // Record 3 (Dec 10 12:00:00) is exactly equal, so it is excluded
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'gt', value: '2025-12-10T12:00:00.000Z', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with lt on ISO datetime string with timezone (Z) — uses exact timestamp', async () => {
        // lt '2025-12-05T11:00:00.000Z' → < '2025-12-05 11:00:00' → only Record 1 (Dec 01 10:00)
        // Record 2 (Dec 05 11:00:00) is exactly equal, so it is excluded
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'lt', value: '2025-12-05T11:00:00.000Z', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with gt on slash-separated date string (2025/12/10) — normalizes slashes to dashes', async () => {
        // '2025/12/10' → '2025-12-10' → > '2025-12-10 23:59:59' → only Record 4 (Dec 25)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'gt', value: '2025/12/10', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(1);
    });

    it('should filter with lte on slash-separated date string (2025/12/05) — normalizes slashes to dashes', async () => {
        // '2025/12/05' → '2025-12-05' → <= '2025-12-05 23:59:59' → Record 1 (Dec 01) + Record 2 (Dec 05 11:00)
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [{ field: 'created_at', operator: 'lte', value: '2025/12/05', type: 'AND' }],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should filter with neq OR gte combining OR conditions', async () => {
        const dto = {
            report: 'reports_vista_test',
            period: { field: 'created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
            conditions: [
                { field: 'status', operator: 'neq', value: 'active', type: 'OR' },
                { field: 'id', operator: 'gte', value: 4, type: 'OR' },
            ],
        };

        const result = await reportCreator.execute(dto);

        expect(result.recordCount).toBe(2);
    });

    it('should exclude internal filter_* columns from the exported file', async () => {
        await repository.connection.raw('DROP VIEW IF EXISTS reports_vista_test');
        await repository.connection.raw(`
            CREATE VIEW reports_vista_test AS
            SELECT
                1 AS id,
                'Test Case 1' AS name,
                '2025-12-01 10:00:00'::timestamp AS created_at,
                '2025-12-01 10:00:00'::timestamp AS filter_created_at,
                'active' AS status
            UNION ALL
            SELECT
                2 AS id,
                'Test Case 2' AS name,
                '2025-12-05 11:00:00'::timestamp AS created_at,
                '2025-12-05 11:00:00'::timestamp AS filter_created_at,
                'pending' AS status;
        `);

        const generateStreamSpy = jest.spyOn(excelExporter, 'generateStream');

        try {
            const dto = {
                report: 'reports_vista_test',
                period: { field: 'filter_created_at', initial_date: '2025-12-01', end_date: '2025-12-31' },
                conditions: [],
            };

            const result = await reportCreator.execute(dto);

            expect(result.recordCount).toBe(2);
            expect(generateStreamSpy).toHaveBeenCalled();

            const exportedColumnKeys = generateStreamSpy.mock.calls[0][0].columns.map((c) => c.key);
            expect(exportedColumnKeys).not.toContain('filter_created_at');
            expect(exportedColumnKeys).toEqual(expect.arrayContaining(['id', 'name', 'created_at', 'status']));
        } finally {
            generateStreamSpy.mockRestore();
        }
    });
});
