import { BaseController, HttpResponse } from '@kace/api-common';
import {
    applyServerManagedFields,
    objectIdentityErrorResponse,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    KnexAppointmentRepository,
    AppointmentReScheduler,
    KnexAppointmentValidationRepository,
} from '@kace/core/src/appointments/index.js';
import { Helper } from '@kace/core/src/shared';
import { rescheduleSchema } from './schemas.mjs';

export default class ControllerReScheduler extends BaseController {
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
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsReschedule');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to reschedule appointments.',
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

            const payload = applyServerManagedFields(this.payload(), {
                userId: this.user.id.value,
                now: this.started_at,
            });
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
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
