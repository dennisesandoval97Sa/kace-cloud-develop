import { ClassificationsSelectSearcher, KnexClassificationRepository } from '@kace/core/src/classifications';
import { HttpResponse, BaseController } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerList extends BaseController {
    #event; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationRepository(knexConfig, readerConfig);
        this.#event = event;
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin List actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'classifications', 'ClassificationRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const response = await new ClassificationsSelectSearcher(this.repository).execute();
            return HttpResponse.ok({ ...response.toJson(), event: this.#event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
