import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import {
    CsvExportViewExecutionService,
    CsvExportViewManualExecutor,
    KnexCsvExportViewRepository,
    S3StorageService,
} from '@kace/core/src/csv-export-views';

export class ExecuteController extends BaseController {
    /** @type {CsvExportViewManualExecutor}  is initialized in the constructor */
    #executor;
    /** @type {KnexCsvExportViewRepository} is initialized in the constructor */
    #csvExportViewRepository;
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        const csvExportViewRepository = new KnexCsvExportViewRepository(knexConfig, readerConfig);
        this.#csvExportViewRepository = csvExportViewRepository;
        const s3StorageService = new S3StorageService({
            region: process.env.AWS_S3_REGION,
            accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
            bucket: process.env.AWS_S3_BUCKET,
        });
        const executionService = new CsvExportViewExecutionService({
            csvExportViewRepository,
            s3StorageService,
        });
        this.#executor = new CsvExportViewManualExecutor({
            executionService,
            csvExportViewRepository,
        });
    }

    async destroyDbConnection() {
        await this.#csvExportViewRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'csv-export-views', 'GenerateCsvRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read CSV export views.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const results = await this.#executor.execute(id);
            return HttpResponse.ok({
                message: 'Archivos CSV generados y subidos correctamente a S3.',
                data: results,
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
}
