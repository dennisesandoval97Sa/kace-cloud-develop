import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexExportsRepository } from '@kace/core/src/exports/infraestructure/persistence/KnexExportsRepository.js';
import { ExportTableData } from '@kace/core/src/exports/application/ExportTableData.js';
import { ExportTableDataSchema } from './schemas.mjs';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexExportsRepository(knexConfig, readerConfig);
        this.startedAt = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'exports', 'Exports');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to export data.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const data = ExportTableDataSchema.validate(payload, {
                abortEarly: false,
            });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const downloadURL = await new ExportTableData(this.repository).execute(data.value);

            return HttpResponse.created({ data: downloadURL, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
