import { updateSchema } from './schemas.mjs';
import { BaseController, HttpResponse } from '@kace/api-common';
import { GlobalConfigUpdater, KnexGlobalConfigurationRepository } from '@kace/core/src/global-config';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexGlobalConfigurationRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'global-configurations',
                'GlobalConfigurationsUpdate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
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

            const payload = this.payload();

            const { type, application, module } = payload;

            delete payload.type;
            delete payload.application;
            delete payload.module;

            const { error, value: data } = updateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            await new GlobalConfigUpdater(this.repository).setConfiguration(id, type, application, module, data);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }
}
