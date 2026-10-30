import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { ChannelHubRegistrationFlowValidator } from '@kace/core/src/channel-hub-accounts/domain/ChannelHubRegistrationFlowValidator.js';
import { KnexChannelHubAccountRepository } from '@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createWorkspacePriorityApplication } from './createWorkspacePriorityApplication.mjs';
import {
    ChannelHubAccountAuthorizationError,
    ChannelHubAccountPaginationError,
    ChannelHubAccountValidationError,
} from './ChannelHubAccountActionsApplication.mjs';
import { createChannelHubAccountActionsApplication } from './createChannelHubAccountActionsApplication.mjs';
import { createChannelHubWorkflowExecutor } from './createChannelHubWorkflowExecutor.mjs';
import {
    createWorkspacePriorityApplicationArguments,
    WorkspacePriorityControllerBoundary,
} from './WorkspacePriorityControllerBoundary.mjs';

export { workspacePriorityErrorResponse } from './WorkspacePriorityControllerBoundary.mjs';

export class Controller extends BaseController {
    constructor(
        event,
        knexConfig,
        workspacePriorityApplicationFactory = createWorkspacePriorityApplication,
        accountActionsApplicationFactory = createChannelHubAccountActionsApplication
    ) {
        super(event, knexConfig);
        this.repository = new KnexChannelHubAccountRepository(this.database_connection);
        this.wsRestFlowRepository = new KnexWSRestFlowRepository(this.database_connection);
        this.registrationFlowValidator = new ChannelHubRegistrationFlowValidator(this.wsRestFlowRepository);
        this.workspacePriorityApplicationFactory = workspacePriorityApplicationFactory;
        this.accountActionsApplicationFactory = accountActionsApplicationFactory;
        this.writerConfig = knexConfig;
        this.readerConfig = event.tenantContext?.readerConfig ?? null;
        this.started_at = new Date();
    }

    async #createWorkflowExecutor(user = this.user) {
        return createChannelHubWorkflowExecutor({
            writerConfig: this.writerConfig,
            readerConfig: this.readerConfig,
            authenticatedUser: user,
        });
    }

    #workspacePriorityBoundary() {
        return new WorkspacePriorityControllerBoundary({
            event: this.event,
            pathParameters: () => this.pathParameters(),
            payload: () => this.payload(),
            tenant: () => this.tenant,
            applicationFactory: this.workspacePriorityApplicationFactory,
            applicationFactoryArguments: createWorkspacePriorityApplicationArguments({
                writerConfig: this.writerConfig,
                readerConfig: this.readerConfig,
                createWorkflowExecutor: (user) => this.#createWorkflowExecutor(user),
                eventBus: this.eventPublisher,
            }),
            logger: Helper,
        });
    }

    async #createAccountActionsApplication() {
        const workflowExecutor = await this.#createWorkflowExecutor();
        try {
            return await this.accountActionsApplicationFactory({
                repository: this.repository,
                registrationFlowValidator: this.registrationFlowValidator,
                workflowExecutor,
                createdAt: this.started_at,
            });
        } catch (error) {
            await workflowExecutor.destroy?.();
            throw error;
        }
    }

    async #withAccountActionsApplication(execute) {
        const application = await this.#createAccountActionsApplication();
        try {
            return await execute(application);
        } finally {
            await application.destroy?.();
        }
    }

    #accountActionErrorResponse(error) {
        if (error instanceof ChannelHubAccountAuthorizationError) {
            return HttpResponse.forbidden({ message: error.message, event: this.event });
        }
        if (error instanceof ChannelHubAccountValidationError) {
            return HttpResponse.validationsFail({ errors: error.validationError, event: this.event });
        }
        if (error instanceof ChannelHubAccountPaginationError) {
            return HttpResponse.badRequest({ message: 'Invalid pagination parameters', event: this.event });
        }
        return null;
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            await this.#withAccountActionsApplication((application) => application.create(this.payload(), this.user));
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const id = this.pathParameters().id;
            await this.#withAccountActionsApplication((application) =>
                application.update(id, this.payload(), this.user)
            );
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const id = this.pathParameters().id;
            await this.#withAccountActionsApplication((application) => application.delete(id, this.user));
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const id = this.pathParameters().id;
            const response = await this.#withAccountActionsApplication((application) =>
                application.find(id, this.user)
            );
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const queryString = this.event.queryStringParameters ?? {};
            const response = await this.#withAccountActionsApplication((application) =>
                application.index(queryString, this.user)
            );
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
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
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead');
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

            const authorizedQuery = this.#authorizeSearch('channel-hub.search', data.value);
            const response = await this.#withAccountActionsApplication((application) =>
                application.search(authorizedQuery, this.user)
            );
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = this.#accountActionErrorResponse(error);
            if (response) return response;

            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionRegister() {
        Helper.logInfo('Begin actionRegister');
        try {
            const id = this.pathParameters().id;
            await this.#withAccountActionsApplication((application) => application.register(id, this.user));

            return HttpResponse.ok({ message: 'Account registered successfully', event: this.event });
        } catch (error) {
            const response = this.#accountActionErrorResponse(error);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({ event: this.event });
        } finally {
            Helper.logInfo('End actionRegister');
        }
    }

    async actionWorkspacePriorityList() {
        return this.#workspacePriorityBoundary().list(this.user);
    }

    async actionWorkspacePriorityReorder() {
        return this.#workspacePriorityBoundary().reorder(this.user);
    }

    async actionWorkspacePriorityReorderStatus() {
        return this.#workspacePriorityBoundary().status(this.user);
    }
}
