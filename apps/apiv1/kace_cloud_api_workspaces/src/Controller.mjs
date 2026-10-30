import {
    publicErrorCodeForWorkspaceValidation,
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
} from './WorkspaceSchema.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { WorkspaceCreator } from '@kace/core/src/workspaces/application/create/WorkspaceCreator.js';
import { WorkspaceDeleter } from '@kace/core/src/workspaces/application/delete/WorkspaceDeleter.js';
import { WorkspaceFinder } from '@kace/core/src/workspaces/application/find/WorkspaceFinder.js';
import { WorkspaceSearcher } from '@kace/core/src/workspaces/application/search/WorkspaceSearcher.js';
import { WorkspaceUpdater } from '@kace/core/src/workspaces/application/update/WorkspaceUpdater.js';
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { KnexWSRestFlowExecutionRepository } from '@kace/core/src/ws-rest-flow-executions/index.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import * as apiCommon from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import * as workspaceTagUpdates from './WorkspaceTagUpdateFlowQueuer.mjs';
import { WorkspaceDeletionApplication } from './WorkspaceDeletionApplication.mjs';

const { HttpResponse, BaseController, Response, SearchAuthorizationError, SearchAuthorizationService } = apiCommon;

const loadObjectIdentityAuthorization = () => import('@kace/api-common/src/security/ObjectIdentityAuthorization.js');
const OBJECT_IDENTITY_AUTHORIZATION_ERROR_NAME = 'ObjectIdentityAuthorizationError';

export class Controller extends BaseController {
    constructor(event, knexConfig, objectIdentityAuthorizationLoader = loadObjectIdentityAuthorization) {
        super(event, knexConfig);
        /*
         * Pass CONFIG objects (not this.database_connection, a built Knex instance —
         * that would collapse the reader onto the writer, §8.1 footgun).
         */
        const { readerConfig } = this.event.tenantContext ?? {};
        this.repository = new KnexWorkspacesRepository(knexConfig, readerConfig);
        this.executionRepository = new KnexWSRestFlowExecutionRepository(this.database_connection);
        this.objectIdentityAuthorizationLoader = objectIdentityAuthorizationLoader;
        this.started_at = new Date();
    }

    createWorkflowExecutor(currentUser, options = {}) {
        const dependencies = [
            new KnexWSRestWorkflowStepRepository(this.database_connection),
            new KnexAllowedConnectionsRepository(this.database_connection),
            new KnexSecretsVaultRepository(this.database_connection),
            currentUser,
        ];
        return Object.keys(options).length > 0
            ? new WorkflowExecutor(...dependencies, options)
            : new WorkflowExecutor(...dependencies);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async objectIdentityErrorResponse(error) {
        if (error?.name !== OBJECT_IDENTITY_AUTHORIZATION_ERROR_NAME) return null;
        const { objectIdentityErrorResponse } = await this.objectIdentityAuthorizationLoader();
        return objectIdentityErrorResponse(error, this.event);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const { secureObjectCreatePayload } = await this.objectIdentityAuthorizationLoader();
            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /workspaces',
                resourceType: 'workspaces',
                repository: this.repository,
            });

            const data = WorkspaceCreateSchema.validate(payload, {
                abortEarly: false,
            });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                    code: publicErrorCodeForWorkspaceValidation(data.error),
                });
            }
            await new WorkspaceCreator(this.repository).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
            Helper.logInfo(error);
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

            const payload = this.payload();
            payload.updated_at = new Date().toISOString();
            payload.updated_by = this.user.id.value;
            const data = WorkspaceUpdateSchema.validate(payload, {
                abortEarly: false,
            });

            if (data.error) {
                const guidance = data.error.details.some(
                    (detail) => detail.path[0] === 'is_active' && detail.type === 'any.invalid'
                )
                    ? { deactivationEndpoint: 'POST /workspaces/:id/deactivate' }
                    : null;
                return new Response({
                    message: 'Validations fail',
                    statusCode: 400,
                    errors: data.error,
                    event: this.event,
                    publicErrorCode: publicErrorCodeForWorkspaceValidation(data.error),
                    data: guidance ?? {},
                    publicData: guidance,
                });
            }
            /*
             * Capture removed-account delete targets BEFORE persisting: the repository
             * replaces relation rows wholesale, so the previous set is unreadable after.
             */
            let removedTargets = [];
            let previousWorkspace = null;
            const channelHubAccountsWereSubmitted = Object.prototype.hasOwnProperty.call(
                data.value,
                'channel_hub_accounts'
            );
            if (channelHubAccountsWereSubmitted) {
                previousWorkspace = workspaceTagUpdates.workspaceToJson(await this.repository.find({ value: id }));
            }

            if (channelHubAccountsWereSubmitted) {
                if (previousWorkspace) {
                    removedTargets = workspaceTagUpdates.removedChannelHubRuleTargets(
                        previousWorkspace,
                        data.value.channel_hub_accounts
                    );
                }
                if (removedTargets.length > 0 && Object.prototype.hasOwnProperty.call(data.value, 'rules')) {
                    data.value.rules = workspaceTagUpdates.rulesWithoutRemovedLegacyRuleId(
                        data.value.rules,
                        removedTargets
                    );
                }
            }

            await new WorkspaceUpdater(this.repository).execute(data.value, id);

            const tagFlowQueuer = new workspaceTagUpdates.WorkspaceTagUpdateFlowQueuer({
                workspaceRepository: this.repository,
                executionRepository: this.executionRepository,
                eventPublisher: this.eventPublisher,
                currentUser: this.user,
                metadata: {
                    tenant_id: this.tenant.id.value,
                    user_id: this.user.id.value,
                },
                kaceApiBaseUrl: this.tenant.apps_execute_rest_hook_service_url.value,
            });
            if (removedTargets.length > 0) {
                await tagFlowQueuer.execute(id, 'delete', { targets: removedTargets });
            }
            await tagFlowQueuer.execute(id);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
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
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesDelete');
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
            const dtoDelete = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };
            const tagFlowQueuer = new workspaceTagUpdates.WorkspaceTagUpdateFlowQueuer({
                workspaceRepository: this.repository,
                executionRepository: this.executionRepository,
                eventPublisher: this.eventPublisher,
                currentUser: this.user,
                metadata: {
                    tenant_id: this.tenant.id.value,
                    user_id: this.user.id.value,
                },
                kaceApiBaseUrl: this.tenant.apps_execute_rest_hook_service_url.value,
            });
            await new WorkspaceDeletionApplication({
                tagFlowQueuer,
                workspaceDeleter: new WorkspaceDeleter(this.repository),
            }).execute(id, dtoDelete);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesRead');
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
            const workspace = await new WorkspaceFinder(this.repository).execute(id);

            return HttpResponse.ok({
                data: {
                    ...workspace.toJson(),
                },
                event: this.event,
            });
        } catch (error) {
            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
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
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = {
                filter: undefined,
                relationships: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };

            const workspace = await new WorkspaceSearcher(this.repository).execute(payload);
            return HttpResponse.ok({ ...workspace.toJson(), event: this.event });
        } catch (error) {
            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
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
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const data = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('workspaces.search', data.value);
            const workspaces = await new WorkspaceSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({ ...workspaces.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = await this.objectIdentityErrorResponse(error);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
