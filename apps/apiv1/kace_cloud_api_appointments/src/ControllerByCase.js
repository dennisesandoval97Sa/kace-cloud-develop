import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexAppointmentRepository } from '@kace/core/src/appointments/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import AppointmentCounterByCase from '@kace/core/src/appointments/application/count/AppointmentCounterByCase';

export default class ControllerByCase extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Read-only controller (count by case) → wire the reader (pass CONFIG objects,
        // not this.database_connection, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAppointmentRepository(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'appointments', 'AppointmentsCountByCase');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to count appointments by case.',
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

            const service = new AppointmentCounterByCase(this.repository);
            const count = await service.execute(id);

            return HttpResponse.ok({ data: { count }, event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }
}
