import { BaseController, HttpResponse } from '@kace/api-common';
import { UserIntegrationActivityUpdater } from '@kace/core/src/users/application/update/UserIntegrationActivityUpdater.js';
import { integrationActivitySchema } from './schemas.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';

export default class ControllerIntegrationActivity extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexUsersRepository(this.database_connection);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionIntegrationActivity');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.event.pathParameters?.id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = integrationActivitySchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const updater = new UserIntegrationActivityUpdater(this.repository);
            await updater.execute(id, data.value.timestamp);

            return HttpResponse.ok({
                message: `Integration activity updated for user ${id}`,
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error in actionIntegrationActivity', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIntegrationActivity');
        }
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }
}
