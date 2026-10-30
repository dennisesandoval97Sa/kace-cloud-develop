import { jest } from '@jest/globals';
import { S3ImportsProcessor } from '../../src/imports/application/imports-processor/S3ImportsProcessor.js';
import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { CsvParserService } from '../../src/imports/infrastructure/csv/CsvParserService.js';
import { CsvRecordProcessorService } from '../../src/imports/domain/services/CsvRecordProcessorService.js';
import { AuxDefinitionTableNameFinder } from '../../src/aux_definitions/domain/AuxDefinitionTableNameFinder.js';
import { SchemaRules } from '../../src/schemas/application/rules/SchemaRules.js';
import { S3Client } from '@aws-sdk/client-s3';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

const runWithTenant = (callback) => TenantContext.run(tenant, callback);

const dataStructure = {
    nombre: { type: 'string', required: false, empty: true, trim: true, transform: true, uppercase: true },
    cantidad: { type: 'number', required: false },
    activo: { type: 'boolean', required: false },
    fecha: { type: 'date', required: false },
    estado: { type: 'string', required: false, empty: true, default: 'ABIERTO' },
};

/**
 * Deja el importador en su camino real de auxiliares: descarga mockeada, CSV ya parseado y el
 * esquema del auxiliar resuelto. Lo único que no se ejecuta es la escritura en BD, que se captura.
 */
const mockAuxImportFlow = (csvContent) => {
    const fileRecord = {
        id: { value: 'import-id-1' },
        created_by: { value: 'user-1' },
        file_path: { value: 'bucket-name/imports/file.csv' },
        target_table: { value: 'aux_pruebas' },
        upload_attempts: { value: 0 },
        error_details: null,
    };

    jest.spyOn(KnexS3ImportFiles.prototype, 'findFileToProcess')
        .mockResolvedValueOnce(fileRecord)
        .mockResolvedValue(null);
    jest.spyOn(KnexS3ImportFiles.prototype, 'getNotificationsConfig').mockResolvedValue(null);
    jest.spyOn(KnexS3ImportFiles.prototype, 'findUserToNotify').mockResolvedValue(null);
    jest.spyOn(CsvParserService, 'parse').mockResolvedValue(csvContent);
    jest.spyOn(AuxDefinitionTableNameFinder.prototype, 'execute').mockResolvedValue({
        schema_id: { value: 'schema-1' },
    });
    jest.spyOn(SchemaRules.prototype, 'execute').mockResolvedValue({
        toJson: () => ({ data: { data_structure: dataStructure } }),
    });
    jest.spyOn(BackgroundExecutionService.prototype, 'findBackgroundExecution').mockResolvedValue({
        isRunning: () => false,
    });
    jest.spyOn(BackgroundExecutionService.prototype, 'updateBackgroundExecution').mockResolvedValue(undefined);
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({
        Body: {
            setEncoding() {},
            on(event, handler) {
                // El contenido real es irrelevante: `CsvParserService.parse` está mockeado; sólo
                // debe ser no vacío para que el procesador no aborte la descarga.
                if (event === 'data') handler('id\n');
                if (event === 'end') handler();
                return this;
            },
        },
    });

    const updateImportSpy = jest.spyOn(KnexS3ImportFiles.prototype, 'updateImport').mockResolvedValue(undefined);
    const processSpy = jest
        .spyOn(CsvRecordProcessorService, 'execute')
        .mockResolvedValue({ status: 'completed', errors: [] });

    return { processSpy, updateImportSpy };
};

const importRow = async (row) => {
    const { processSpy, updateImportSpy } = mockAuxImportFlow([row]);

    await runWithTenant(async () => {
        const processor = new S3ImportsProcessor(() => 60_000);
        await processor.processPendingsImports();
    });

    const rejected = updateImportSpy.mock.calls.find(([, update]) => ['rejected', 'failed'].includes(update?.status));
    expect(rejected?.[1]?.error_details).toBeUndefined();
    expect(processSpy).toHaveBeenCalled();

    const [records] = processSpy.mock.calls[0];
    return records[0];
};

describe('S3ImportsProcessor: normalización de los registros auxiliares importados', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('adopta la coerción de Joi para el texto sin tipar del CSV', async () => {
        const record = await importRow({
            id: '11111111-1111-4111-8111-111111111111',
            nombre: ' ana',
            cantidad: '41',
            activo: 'true',
        });

        expect(record).toMatchObject({ nombre: 'ANA', cantidad: 41, activo: true });
    });

    it('materializa el default del esquema cuando la columna viene vacía', async () => {
        const record = await importRow({ id: '11111111-1111-4111-8111-111111111111', nombre: 'ana', estado: '' });

        expect(record.estado).toBe('ABIERTO');
    });

    it('normaliza una fecha legacy a su forma ISO, como antes de este fix', async () => {
        const record = await importRow({
            id: '11111111-1111-4111-8111-111111111111',
            nombre: 'ana',
            fecha: '01/15/2026',
        });

        expect(new Date(record.fecha).toISOString()).toBe(new Date('01/15/2026').toISOString());
    });
});
