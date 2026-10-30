import {
    StatesDistinctionFinder,
    KnexClassificationsLevelDistinctionRepository as KnexStatesDistinctionRepository,
} from '@kace/core/src/states';
import { HttpResponse, BaseController } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexStatesDistinctionRepository(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'state', 'StatesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const finder = new StatesDistinctionFinder(this.repository);
            const response = await finder.execute();
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
