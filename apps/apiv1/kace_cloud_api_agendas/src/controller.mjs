import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    KnexAgendaRepository,
    AgendaCreator,
    AgendaUpdater,
    AgendaDeleter,
    AgendaFinder,
    FindAllAgendas,
    AgendaSearcher,
} from '@kace/core/src/agendas/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createSchema, updateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAgendaRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create agendas.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /agendas',
                resourceType: 'agendas',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new AgendaCreator(this.repository).execute(data.value);
            return HttpResponse.created({ data: { id: data.value.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionCreate');
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');

        const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasUpdate');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to update agendas.',
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
            await new AgendaUpdater(this.repository).execute(id, data.value);
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

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');

        const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasDelete');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to delete agendas.',
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
            await new AgendaDeleter(this.repository).execute(id, dto);
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

    async actionRead() {
        Helper.logInfo('Begin actionRead');

        const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read agendas.',
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
            const agendaResponse = await new AgendaFinder(this.repository).execute(id);

            if (!agendaResponse) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({
                ...agendaResponse.toJson(),
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

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to list agendas.',
                event: this.event,
            });
        }

        try {
            const agendasResponse = await new FindAllAgendas(this.repository).execute();
            return HttpResponse.ok({
                ...agendasResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#logAndHandleError(error, 'actionIndex');
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

        const hasPermission = this.user.hasPermission('administrador', 'agendas', 'AgendasRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to search agendas.',
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
            const authorizedQuery = this.#authorizeSearch('agendas.search', value);
            const agendasResponse = await new AgendaSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({
                ...agendasResponse.toJson(),
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

    #getIdFromPath() {
        return this.pathParameters()?.id;
    }

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

    #logAndHandleError(error, action) {
        Helper.logError(`Error in ${action}`, {
            name: error.name,
            message: error.message,
            stack: error.stack || 'No stack trace available',
        });
        return this.#handleError(error);
    }
}
