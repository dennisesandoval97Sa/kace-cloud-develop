import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
    activeGroupScopeFromAuthenticatedUser,
} from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper } from '@kace/core/src/shared';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { InteractionCreator } from '@kace/core/src/interactions/application/create/InteractionCreator';
import { InteractionUpdater } from '@kace/core/src/interactions/application/update/InteractionUpdater';
import { InteractionDeleter } from '@kace/core/src/interactions/application/delete/InteractionDeleter';
import { InteractionFinder } from '@kace/core/src/interactions/application/find/InteractionFinder';
import { InteractionSearcher } from '@kace/core/src/interactions/application/search/InteractionSearcher';
import { InteractionEmailAlreadyLinkedError } from '@kace/core/src/interactions/domain/InteractionEmailAlreadyLinkedError.js';
import { canImportInteractionState } from '@kace/core/src/interactions/application/create/InteractionStateImportPolicy.js';
import { interactionCreate, interactionUpdate } from './schemas.mjs';
import { executeInteractionSearch } from './interaction-search-action.mjs';

export class Controller extends BaseController {
    #event;

    constructor(event, knexConfig) {
        super(event, knexConfig);

        // CRUD reads (find/search/count) go to the replica; writes are guarded by markWrite.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexInteractionRepository(knexConfig, readerConfig);
        this.started_at = new Date();
        this.#event = event;
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsCreate');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.#event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /interactions',
                resourceType: 'interactions',
                repository: this.repository,
            });

            const data = interactionCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            if (!canImportInteractionState(this.user, data.value)) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to import interaction state.',
                    event: this.#event,
                });
            }

            const createdInteraction = await new InteractionCreator(this.repository).execute(data.value);

            return HttpResponse.created({ data: { id: createdInteraction.id.value }, event: this.#event });
        } catch (error) {
            if (error instanceof InteractionEmailAlreadyLinkedError) {
                return HttpResponse.conflict({
                    message: error.message,
                    data: error.toPublicData(),
                    publicData: error.toPublicData(),
                    event: this.#event,
                    code: error.publicErrorCode,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.#event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.#event,
                });
            }

            const payload = this.payload();

            const data = interactionUpdate.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            data.value.updated_at = new Date().toISOString();
            data.value.updated_by = this.user.id.value;

            const response = await new InteractionUpdater(this.repository).execute(data.value, id, this.user.id.value);
            return HttpResponse.ok({ data: response.toJson(), event: this.#event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsDelete');
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

            await new InteractionDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
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
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.#event,
                });
            }
            const response = await new InteractionFinder(this.repository).execute(id);
            return HttpResponse.ok({ ...response.toJson(), event: this.#event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read this resource.',
                event: this.#event,
            });
        }
        try {
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
            const response = await new InteractionSearcher(this.repository).execute(dtoCriteria);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
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
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            const response = await executeInteractionSearch({
                event: this.#event,
                user: this.user,
                query: data.value,
                authorize: (endpointKey, query) => this.#authorizeSearch(endpointKey, query),
                repository: this.repository,
                createSearcher: (repository) => new InteractionSearcher(repository),
                activeGroupScopeFromUser: activeGroupScopeFromAuthenticatedUser,
            });

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
