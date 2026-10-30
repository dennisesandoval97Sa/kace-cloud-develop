import { HttpResponse } from '@kace/api-common';
import { FolioConfigurationClassificationsFinder } from '@kace/core/src/folio-configurations/application/classifications/FolioConfigurationClassificationsFinder.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { FolioBaseController, MODULE } from './folioBaseController.mjs';

/**
 * GET /folio-configurations/{id}/classifications, dispatched by handler.mjs as GET /{id}.
 *
 * Read-only: the association is written from the classification form, which sets
 * clasificaciones.folio_config_id.
 */
export class ControllerClassifications extends FolioBaseController {
    async actionRead() {
        Helper.logInfo('Begin ControllerClassifications::actionRead');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsRead')) {
                return this.forbidden('read');
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const finder = new FolioConfigurationClassificationsFinder(this.repository);

            return HttpResponse.ok({
                data: { classifications: await finder.execute(id) },
                event: this.event,
            });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End ControllerClassifications::actionRead');
        }
    }
}
