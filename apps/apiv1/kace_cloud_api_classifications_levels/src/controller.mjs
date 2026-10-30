import { BaseController, HttpResponse } from '@kace/api-common';
import { schemaBase } from './schemas.mjs';
import ClassificationsLevelDistinctionFinder from '@kace/core/src/ClassificationsLevelDistinction/application/ClassificationsLevelDistinctionFinder.js';
import KnexClassificationsLevelDistinctionRepository from '@kace/core/src/ClassificationsLevelDistinction/infrasctructure/KnexClassificationsLevelDistinctionRepository';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationsLevelDistinctionRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classifications-levels',
                'ClassificationLevelsRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const level = this.pathParameters().id;

            const data = schemaBase.validate({ level: level }, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const response = await new ClassificationsLevelDistinctionFinder(this.repository).execute(data.value.level);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
