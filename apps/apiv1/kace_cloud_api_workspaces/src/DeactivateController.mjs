import { HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { Controller } from './Controller.mjs';
import { createWorkspaceDeactivationApplication } from './createWorkspaceDeactivationApplication.mjs';
import { WorkspaceDeactivateSchema, publicErrorCodeForWorkspaceValidation } from './WorkspaceSchema.mjs';
import { workspaceDeactivationErrorResponse } from './workspaceDeactivationErrorResponse.mjs';

export class DeactivateController extends Controller {
    constructor(event, knexConfig, applicationFactory = createWorkspaceDeactivationApplication) {
        super(event, knexConfig);
        this.applicationFactory = applicationFactory;
    }

    async actionCreate() {
        try {
            if (!this.user.hasPermission('administrador', 'workspaces', 'WorkspacesUpdate')) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const data = WorkspaceDeactivateSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                    code: publicErrorCodeForWorkspaceValidation(data.error),
                });
            }

            const application = await this.applicationFactory({
                workspaceRepository: this.repository,
                workflowExecutorFactory: ({ requestTimeoutMs, requestTimeoutResolver }) =>
                    this.createWorkflowExecutor(this.user, {
                        failOnHttpError: false,
                        requestTimeoutMs,
                        requestTimeoutResolver,
                    }),
                metadata: { tenant_id: this.tenant.id.value, user_id: this.user.id.value },
                kaceApiBaseUrl: this.tenant.apps_execute_rest_hook_service_url.value,
            });
            await application.execute(id, { ...data.value, updated_at: new Date(), updated_by: this.user.id.value });
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            if (error instanceof SyntaxError) return HttpResponse.badRequest({ event: this.event });
            const identityResponse = await this.objectIdentityErrorResponse(error);
            if (identityResponse) return identityResponse;
            Helper.logError('DeactivateController::actionCreate', error);
            return (
                workspaceDeactivationErrorResponse(error, this.event) ??
                HttpResponse.internalServerError({ errors: error, event: this.event })
            );
        }
    }
}
