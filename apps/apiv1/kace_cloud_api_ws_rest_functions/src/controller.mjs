import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { KnexWSRestFunctionRepository } from '@kace/core/src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { WSRestFunctionCreator } from '@kace/core/src/ws_rest_functions/application/create/WSRestFunctionCreator.js';
import { WSRestFunctionUpdater } from '@kace/core/src/ws_rest_functions/application/update/WSRestFunctionUpdater.js';
import { WSRestFunctionDeleter } from '@kace/core/src/ws_rest_functions/application/delete/WSRestFunctionDeleter.js';
import { WSRestFunctionFinder } from '@kace/core/src/ws_rest_functions/application/find/WSRestFunctionFinder.js';
import { WSRestFunctionSearcher } from '@kace/core/src/ws_rest_functions/application/search/WSRestFunctionSearcher.js';
import { createSchema, updateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexWSRestFunctionRepository(this.database_connection);
        this.started_at = new Date();
    }
    /**
     * Creates a new WSRestFunction entity.
     * @returns {Promise<HttpResponse>} A response indicating success or validation/error failure.
     */
    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionCreate');
            if (!hasPermission) {
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
                endpoint: 'POST /ws-rest-functions',
                resourceType: 'ws_rest_functions',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new WSRestFunctionCreator(this.repository).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionCreate');
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
    /**
     * Updates an existing WSRestFunction entity.
     * @returns {Promise<HttpResponse>} A response indicating success or validation/error failure.
     */
    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionUpdate');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to create this resource.',
                event: this.event,
            });
        }
        const id = this.#getIdFromPath();

        if (!this.validateId(id)) {
            return HttpResponse.badRequest({
                message: 'Invalid id',
                event: this.event,
            });
        }

        const payload = this.payload();
        payload.updated_at = new Date();
        payload.updated_by = this.user.id.value;

        const data = updateSchema.validate(payload, { abortEarly: false });

        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            await new WSRestFunctionUpdater(this.repository).execute(id, data.value);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionUpdate');
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }
    /**
     * Deletes an existing WSRestFunction entity by ID.
     * @returns {Promise<HttpResponse>} A response indicating success or error if the ID is invalid or not found.
     */
    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionDelete');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to delete this resource.',
                event: this.event,
            });
        }
        const id = this.#getIdFromPath();

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

        try {
            await new WSRestFunctionDeleter(this.repository).execute(id, dto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionDelete');
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }
    /**
     * Retrieves a single WSRestFunction entity by ID.
     * @returns {Promise<HttpResponse>} A response with the entity data or error if not found.
     */
    async actionRead() {
        Helper.logInfo('Begin actionRead');
        const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read this resource.',
                event: this.event,
            });
        }
        const id = this.#getIdFromPath();

        if (!this.validateId(id)) {
            return HttpResponse.badRequest({
                message: 'Invalid id',
                event: this.event,
            });
        }

        try {
            const wsRestFunctionResponse = await new WSRestFunctionFinder(this.repository).execute(id);

            if (!wsRestFunctionResponse) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({
                ...wsRestFunctionResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionRead');
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
    /**
     * Retrieves a list of WSRestFunction entities with pagination and sorting.
     *
     * Applies default criteria: limit of 10, ordered by `created_at` in descending order.
     *
     * @returns {Promise<HttpResponse>} A response containing the list of entities or an error if the operation fails.
     */
    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionRead');
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

            const response = await new WSRestFunctionSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
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

    /**
     * Searches WSRestFunction entities using filters.
     * @returns {Promise<HttpResponse>} A response with the search results or validation error.
     */

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
        const hasPermission = this.user.hasPermission('administrador', 'ws-rest-functions', 'WsRestFunctionRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read this resource.',
                event: this.event,
            });
        }
        const { value, error } = SearchSchema.validate(this.payload(), {
            abortEarly: false,
        });

        if (error) {
            return HttpResponse.validationsFail({
                errors: error,
                event: this.event,
            });
        }

        try {
            const authorizedQuery = this.#authorizeSearch('ws-rest-functions.search', value);
            const wsRestFunctionResponse = await new WSRestFunctionSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({
                ...wsRestFunctionResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionSearch');
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
    /**
     * Extracts the ID parameter from the request path.
     * @returns {string|undefined} The ID extracted from path parameters.
     */
    #getIdFromPath() {
        return this.pathParameters()?.id;
    }
    /**
     * Handles errors and maps them to appropriate HTTP responses.
     * @param {Error} error - The error to handle.
     * @returns {HttpResponse} The corresponding HTTP error response.
     */
    #handleError(error) {
        const { statusCode = 500 } = error;

        if (statusCode === 400) {
            return HttpResponse.badRequest({ errors: error, event: this.event });
        }

        if (statusCode === 404) {
            return HttpResponse.notFound({ errors: error, event: this.event });
        }

        return HttpResponse.internalServerError({
            errors: error,
            event: this.event,
        });
    }
    /**
     * Logs the error details and delegates to #handleError.
     * @param {Error} error - The error to handle and log.
     * @param {string} action - The name of the action where the error occurred.
     * @returns {HttpResponse} The resulting HTTP response.
     */
    #logAndHandleError(error, action) {
        Helper.logError(`Error in ${action}`, {
            name: error.name,
            message: error.message,
            stack: error.stack || 'No stack trace available',
        });
        return this.#handleError(error);
    }
}
