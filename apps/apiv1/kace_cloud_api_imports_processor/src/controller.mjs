import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { S3ImportsProcessor } from '@kace/core/src/imports/application/imports-processor/S3ImportsProcessor';
import { KnexS3ImportFiles } from '@kace/core/src/imports/infrastructure/persistence/KnexS3ImportFiles';
export class Controller extends BaseController {
    /** @type {function(): number} is initialized in the constructor */
    #remainingTimeMs;
    constructor(event, knexConfig, remainingTimeMs) {
        super(event, knexConfig);
        this.repository = new KnexS3ImportFiles(this.database_connection);
        this.#remainingTimeMs = remainingTimeMs;
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'imports-processor',
                'ImportsProcessorExecute'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to execute import processing.',
                    event: this.event,
                });
            }

            await new S3ImportsProcessor(this.#remainingTimeMs).processPendingsImports();
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
