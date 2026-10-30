import { HttpResponse, activeGroupScopeFromAuthenticatedUser } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { Controller } from './Controller.mjs';

export class AvailableController extends Controller {
    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const workspaces = await this.repository.searchAvailableForActiveGroup(
                activeGroupScopeFromAuthenticatedUser(this.user)
            );
            return HttpResponse.ok({
                data: workspaces.map((workspace) => workspace.toJson()),
                event: this.event,
            });
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
