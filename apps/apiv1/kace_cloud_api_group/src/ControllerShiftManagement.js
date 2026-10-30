import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management';
import { Helper } from '@kace/core/src/shared';
import ShiftManagementFinderByGroup from '@kace/core/src/shift-management/application/find/ShiftManagementFinderByGroup';

export default class ControllerShiftManagement extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexShiftManagementRepository(this.database_connection);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const shiftManagement = await new ShiftManagementFinderByGroup(this.repository).execute(id);
            if (!shiftManagement) {
                return HttpResponse.notFound({
                    message: 'Shift Management not found',
                    event: this.event,
                });
            }

            return HttpResponse.ok({
                ...shiftManagement.toJson(),
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
}
