import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    KnexAppointmentTimeSlotsRepository,
    AppointmentTimeSlotsCreator,
    AppointmentTimeSlotsUpdater,
    AppointmentTimeSlotsDeleter,
    AppointmentTimeSlotsFinder,
    FindAllAppointmentTimeSlots,
    AppointmentTimeSlotsSearcher,
} from '@kace/core/src/appointment-time-slots/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createSchema, updateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAppointmentTimeSlotsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create appointment time slots.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /appointment-time-slots',
                resourceType: 'appointment_time_slots',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new AppointmentTimeSlotsCreator(this.repository).execute(data.value);
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsUpdate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update appointment time slots.',
                    event: this.event,
                });
            }
            await new AppointmentTimeSlotsUpdater(this.repository).execute(id, data.value);
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete appointment time slots.',
                    event: this.event,
                });
            }
            await new AppointmentTimeSlotsDeleter(this.repository).execute(id, dto);
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read appointment time slots.',
                    event: this.event,
                });
            }
            const appointmentTimeSlotsResponse = await new AppointmentTimeSlotsFinder(this.repository).execute(id);

            if (!appointmentTimeSlotsResponse) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({
                ...appointmentTimeSlotsResponse.toJson(),
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to list appointment time slots.',
                    event: this.event,
                });
            }
            const appointmentTimeSlotsCollectionResponse = await new FindAllAppointmentTimeSlots(
                this.repository
            ).execute();
            return HttpResponse.ok({
                ...appointmentTimeSlotsCollectionResponse.toJson(),
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
            const hasPermission = this.user.hasPermission(
                'administrador',
                'appointment-time-slots',
                'AppointmentTimeSlotsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to search appointment time slots.',
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('appointment-time-slots.search', value);
            const appointmentTimeSlotsResponse = await new AppointmentTimeSlotsSearcher(this.repository).execute(
                authorizedQuery
            );
            return HttpResponse.ok({
                ...appointmentTimeSlotsResponse.toJson(),
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
