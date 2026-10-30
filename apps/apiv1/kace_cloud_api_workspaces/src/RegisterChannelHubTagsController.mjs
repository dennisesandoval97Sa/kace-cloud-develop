import { HttpResponse, Response } from '@kace/api-common';
import {
    WorkspaceChannelHubTagRegistrar,
    WorkspaceChannelHubTagRegistrarError,
} from './WorkspaceChannelHubTagRegistrar.mjs';
import { Helper } from '@kace/core/src/shared/index.js';
import { Controller } from './Controller.mjs';

const serializeRegistrarError = (error) => {
    const serialized = { name: error.name, message: error.message };
    if (error.details !== undefined) serialized.details = error.details;
    return serialized;
};

export class RegisterChannelHubTagsController extends Controller {
    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
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

            const result = await new WorkspaceChannelHubTagRegistrar({
                workspaceRepository: this.repository,
                workflowExecutor: this.createWorkflowExecutor(this.user),
                metadata: {
                    tenant_id: this.tenant.id.value,
                    user_id: this.user.id.value,
                },
                currentUser: this.user,
                kaceApiBaseUrl: this.tenant.apps_execute_rest_hook_service_url.value,
            }).execute(id);

            return HttpResponse.ok({ data: result, event: this.event });
        } catch (error) {
            Helper.logError(error);
            if (error instanceof WorkspaceChannelHubTagRegistrarError) {
                const payload = {
                    message: error.message,
                    errors: serializeRegistrarError(error),
                    event: this.event,
                };

                if (error.statusCode === 403) {
                    return HttpResponse.forbidden(payload);
                }

                if (error.statusCode === 404) {
                    return HttpResponse.notFound(payload);
                }

                if (error.statusCode === 400) {
                    return HttpResponse.badRequest(payload);
                }

                return new Response({
                    ...payload,
                    statusCode: error.statusCode,
                });
            }

            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
