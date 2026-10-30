import { BaseController, HttpResponse } from '@kace/api-common';
import { WSRestFlowSelectSearcher, KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerList extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexWSRestFlowRepository(this.database_connection);
    }

    async actionIndex() {
        Helper.logInfo('Begin List actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-rest-flows', 'WsRestFlowsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const response = await new WSRestFlowSelectSearcher(this.repository).execute();

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
