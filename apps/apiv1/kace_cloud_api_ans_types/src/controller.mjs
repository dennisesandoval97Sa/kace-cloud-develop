import { BaseController, HttpResponse } from '@kace/api-common';
import { TypeLister } from '@kace/core/src/ans/application/list/TypeLister.js';
import { KnexAnsRepository } from '@kace/core/src/ans/index.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexAnsRepository(this.database_connection);
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ans', 'AnsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const data = new TypeLister().execute();
            return HttpResponse.ok({ data: { items: data }, event: this.event });
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
