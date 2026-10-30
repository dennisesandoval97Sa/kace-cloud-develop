import { BaseController, HttpResponse } from '@kace/api-common';
import { StateSelectSearcher, KnexStateRepository } from '@kace/core/src/state';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerList extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not a built Knex instance — §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexStateRepository(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin List actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'state', 'StatesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const response = await new StateSelectSearcher(this.repository).execute();

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
