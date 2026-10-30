import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { WSRestEndpointTryoutExecutor } from '@kace/core/src/ws-rest-endpoints';
import { KnexWSRestEndpointRepository } from '@kace/core/src/ws-rest-endpoints';

export class TryoutController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexWSRestEndpointRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionRead() {
        Helper.logInfo('Begin TryoutController::actionUpdate (tryout)');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-rest-endpoints', 'WsRestEndpointsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to tryout this resource.',
                    event: this.event,
                });
            }
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const executor = new WSRestEndpointTryoutExecutor(this.repository.connection);
            const result = await executor.execute(id);

            return HttpResponse.ok({ data: result, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End TryoutController::actionRead');
        }
    }
}
