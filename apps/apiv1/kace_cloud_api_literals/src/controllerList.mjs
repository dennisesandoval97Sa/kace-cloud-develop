import { BaseController, HttpResponse } from '@kace/api-common';
import { LiteralSelectSearcher, KnexLiteralRepository } from '@kace/core/src/literals';
import { Helper } from '@kace/core/src/shared/index.js';

export class controllerList extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexLiteralRepository(this.database_connection);
    }

    async actionIndex() {
        Helper.logInfo('Begin List actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'literals', 'LiteralsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const tipo_literal_id = this.event.pathParameters.id;
            if (!this.validateId(tipo_literal_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const response = await new LiteralSelectSearcher(this.repository).execute(tipo_literal_id);

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
