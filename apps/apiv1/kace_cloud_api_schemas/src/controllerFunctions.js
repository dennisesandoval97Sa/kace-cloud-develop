import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { SchemaFunctionsService } from '@kace/core/src/schemas/application/functions/SchemaFunctionsService';

export class ControllerFunctions extends BaseController {
    #event;
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.started_at = new Date();
        this.#event = event;
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'schemas', 'SchemasRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const response = new SchemaFunctionsService().getAll();
            return HttpResponse.ok({ ...response, event: this.#event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
