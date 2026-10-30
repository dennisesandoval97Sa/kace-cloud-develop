import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    KnexGeolocationRepository,
    GeolocationCreator,
    GeolocationUpdater,
    GeolocationFinder,
    GeolocationDeleter,
    GeolocationSearcher,
    FindAllGeolocation,
} from '@kace/core/src/geolocation/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createSchema, updateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexGeolocationRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create geolocations.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /geolocation',
                resourceType: 'geolocation',
                repository: this.repository,
            });
            payload.user_id ||= this.user.id.value;

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new GeolocationCreator(this.repository).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');

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
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update geolocations.',
                    event: this.event,
                });
            }
            await new GeolocationUpdater(this.repository).execute(id, data.value);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');

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
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete geolocations.',
                    event: this.event,
                });
            }
            await new GeolocationDeleter(this.repository).execute(id, dto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');

        const id = this.#getIdFromPath();

        if (!this.validateId(id)) {
            return HttpResponse.badRequest({
                message: 'Invalid id',
                event: this.event,
            });
        }

        try {
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read geolocations.',
                    event: this.event,
                });
            }
            const agendaResponse = await new GeolocationFinder(this.repository).execute(id);

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
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read geolocations.',
                    event: this.event,
                });
            }
            const agendasResponse = await new FindAllGeolocation(this.repository).execute();
            return HttpResponse.ok({
                ...agendasResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return this.#handleError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'geolocation', 'GeolocationRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read geolocations.',
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('geolocation.search', value);
            const geolocationResponse = await new GeolocationSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({
                ...geolocationResponse.toJson(),
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
            return this.#handleError(error);
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
}
