import { BaseController, HttpResponse } from '@kace/api-common';
import { ListPermissions } from '@kace/core/src/role/domain/ListPermissions.js';
import { Helper } from '@kace/core/src/shared/index.js';

export default class Controller extends BaseController {
    #event; // is initialized in the constructor
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#event = event;
    }

    actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'permissions', 'PermissionsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to view system permissions.',
                    event: this.#event,
                });
            }
            return HttpResponse.ok({
                data: new ListPermissions().toPrimivites(),
                event: this.#event,
            });
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
