import { BaseController, HttpResponse } from '@kace/api-common';
import {
    AppointmentReScheduler,
    KnexAppointmentRepository,
    KnexAppointmentValidationRepository,
} from '@kace/core/src/appointments/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { rescheduleSchema } from './schemas.mjs';

export class CustomController extends BaseController {
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

    async actionReschedule() {
        Helper.logInfo('Begin actionReschedule');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsReschedule');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to reschedule appointments.',
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
            payload.created_at = this.started_at;
            payload.created_by = this.user.id.value;
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;
            payload.start_time = new Date(payload.start_time).getTime();
            payload.end_time = new Date(payload.end_time).getTime();

            const { value, error } = rescheduleSchema.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error.details,
                    event: this.event,
                });
            }

            await new AppointmentReScheduler(this.repository, this.validationRepository).execute(id, value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionReschedule');
        }
    }

    /**
     * @override
     */
    async run() {
        this.user = await this.getLoggedInUser();
        return this.#newActions();
    }

    /**
     * @override
     */
    async runCognitoAuth() {
        return this.#newActions();
    }

    /**
     * @override
     */
    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            POST: {
                '/{id}/re-scheduler': this.actionReschedule,
            },
        };

        const action = resourceActions[method]?.[resource];
        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
            });
        }

        return HttpResponse.methodNotAllowed();
    }

    resource() {
        return this.event.resource;
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
