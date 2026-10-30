import { BaseController, HttpResponse } from '@kace/api-common';
import { CasoAnsCalculator, KnexCaseRepository } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        this.repository = new KnexCaseRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
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

            const kase = await new CasoAnsCalculator(this.repository).execute(id);
            return HttpResponse.ok({ ...kase.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
}
