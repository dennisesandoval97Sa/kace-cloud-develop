import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import { WSRestWorkFlowStepUpdateSchema, WSRestWorkflowStepCreateSchema } from './WSRestWorkflowStepsSchema.mjs';
import { WSRestWorkflowStepCreator } from '@kace/core/src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator';
import { WSRestWorkflowStepUpdater } from '@kace/core/src/ws-rest-workflow-step/application/update/WSRestWorkflowStepUpdater';
import { WSRestWorkflowStepDeleter } from '@kace/core/src/ws-rest-workflow-step/application/delete/WSRestWorkflowStepDeleter';
import { WSRestWorkflowStepFinder } from '@kace/core/src/ws-rest-workflow-step/application/find/WSRestWorkflowStepFinder';
import { WSRestWorkflowStepSearch } from '@kace/core/src/ws-rest-workflow-step/application/search/WSRestWorkflowStepSearch';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexWSRestWorkflowStepRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsCreate'
            );
            if (!hasPermission) {
                Helper.logInfo('Permission denied for actionCreate');
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /ws-rest-steps',
                resourceType: 'ws_rest_steps',
                repository: this.repository,
            });
            Helper.logInfo('Received payload:', payload);

            Helper.logInfo('Validating payload');
            const { value, error } = WSRestWorkflowStepCreateSchema.validate(payload, { abortEarly: false });
            if (error) {
                Helper.logError('Validation failed:', error);
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            Helper.logInfo('Creating workflow step with validated data:', value);
            await new WSRestWorkflowStepCreator(this.repository).execute(value);

            Helper.logInfo('Workflow step created successfully');
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError('Error in actionCreate:', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsUpdate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
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

            const payload = this.payload();
            payload.updated_at = new Date();
            payload.updated_by = this.user.id.value;
            const { value, error } = WSRestWorkFlowStepUpdateSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new WSRestWorkflowStepUpdater(this.repository).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
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

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            await new WSRestWorkflowStepDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsRead'
            );
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

            const response = await new WSRestWorkflowStepFinder(this.repository, this.user).execute(id);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };

            const response = new WSRestWorkflowStepSearch(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({
                ...(await response).toJson(),
                event: this.event,
            });
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

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-rest-workflow-steps',
                'WsRestWorkFlowsStepsRead'
            );
            if (!hasPermission) {
                Helper.logInfo('Permission denied for actionSearch');
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            Helper.logInfo('Validating search payload');
            const { value, error } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                Helper.logInfo('Search validation failed:', error);
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            Helper.logInfo('Executing search with criteria:', value);
            const authorizedQuery = this.#authorizeSearch('ws-rest-steps.search', value);
            const response = await new WSRestWorkflowStepSearch(this.repository).execute(authorizedQuery);

            Helper.logInfo('Search completed successfully');
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError('Error in actionSearch:', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
