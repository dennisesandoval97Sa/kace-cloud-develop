import { BaseController, HttpResponse } from '@kace/api-common';
import { MailAccountTypesResponse } from '@kace/core/src/mail-accounts';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    #event; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.started_at = new Date();
        this.#event = event;
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'mail-accounts', 'MailAccountsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }
            const response = new MailAccountTypesResponse();

            return HttpResponse.ok({ ...response.toJson(), event: this.#event });
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
