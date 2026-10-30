import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    AppointmentCreator,
    AppointmentUpdater,
    AppointmentFinder,
    AppointmentDeleter,
    AppointmentSearcher,
    FindAllAppointments,
    KnexAppointmentRepository,
    KnexAppointmentValidationRepository,
} from '@kace/core/src/appointments/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createSchema, updateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Only the appointment repository serves read endpoints (findAll/search/countByCase) → wire the
        // reader (pass CONFIG objects, not this.database_connection, §8.1 footgun). The validation
        // repository holds the anti-double-booking guards and stays entirely on the writer.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAppointmentRepository(knexConfig, readerConfig);
        this.validationRepository = new KnexAppointmentValidationRepository(this.database_connection);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create appointments.',
                    event: this.event,
                });
            }
            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /appointments',
                resourceType: 'appointments',
                repository: this.repository,
            });
            payload.start_time = new Date(payload.start_time).getTime();
            payload.end_time = new Date(payload.end_time).getTime();

            const { value, error } = createSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error.details,
                    event: this.event,
                });
            }

            await new AppointmentCreator(this.repository, this.validationRepository).execute(value);

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
        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update appointments.',
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
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;

            if (payload.start_time) {
                payload.start_time = new Date(payload.start_time).getTime();
            }
            if (payload.end_time) {
                payload.end_time = new Date(payload.end_time).getTime();
            }

            const { value, error } = updateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error.details,
                    event: this.event,
                });
            }

            await new AppointmentUpdater(this.repository, this.validationRepository).execute(id, value);

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
            deleted_at: this.started_at,
            deleted_by: this.user.id.value,
        };

        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete appointments.',
                    event: this.event,
                });
            }
            await new AppointmentDeleter(this.repository).execute(id, dto);
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
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read appointments.',
                    event: this.event,
                });
            }
            const response = await new AppointmentFinder(this.repository).execute(id);

            if (!response) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to list appointments.',
                    event: this.event,
                });
            }
            const response = await new FindAllAppointments(this.repository).execute();
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
                errors: error.details,
                event: this.event,
            });
        }

        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to search appointments.',
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('appointments.search', value);
            const response = await new AppointmentSearcher(this.repository).execute(authorizedQuery);
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
