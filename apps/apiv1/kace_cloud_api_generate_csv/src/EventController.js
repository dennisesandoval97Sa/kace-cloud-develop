import { HttpResponse, ScheduleEventController } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import {
    CsvExportViewExecutionService,
    CsvExportViewExecutor,
    KnexCsvExportViewRepository,
    S3StorageService,
} from '@kace/core/src/csv-export-views';

export class EventController extends ScheduleEventController {
    /** @type {CsvExportViewExecutor}  is initialized in the constructor */
    #executor;
    /** @type {KnexCsvExportViewRepository} is initialized in the constructor */
    #csvExportViewRepository;
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun). The repo enforces
        // the split: fetchViewData reads the replica while findByNextExecutionAt/update
        // (last/next_execution_at) stay on the writer.
        const { readerConfig } = this.event.tenantContext;
        const csvExportViewRepository = new KnexCsvExportViewRepository(knexConfig, readerConfig);
        this.#csvExportViewRepository = csvExportViewRepository;
        const s3StorageService = new S3StorageService({
            region: this.event.tenantContext.tenant.aws_s3_region.value,
            accessKeyId: this.event.tenantContext.tenant.aws_s3_access_key_id.value,
            secretAccessKey: this.event.tenantContext.tenant.aws_s3_secret_access_key.value,
            bucket: this.event.tenantContext.tenant.aws_s3_bucket.value,
        });
        const executionService = new CsvExportViewExecutionService({
            csvExportViewRepository,
            s3StorageService,
        });
        this.#executor = new CsvExportViewExecutor({
            executionService,
            csvExportViewRepository,
        });
    }

    async destroyDbConnection() {
        await this.#csvExportViewRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    /**
     *
     * @returns {Promise<Response>}
     */
    async actionDefault() {
        Helper.logInfo('Begin actionDefault');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read CSV export views.',
                    event: this.event,
                });
            }
            const results = await this.#executor.execute();
            return HttpResponse.ok({
                message: 'Archivos CSV generados y subidos correctamente a S3.',
                data: results,
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error en actionDefault: ' + error);
            return HttpResponse.badRequest({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDefault');
        }
    }
}
