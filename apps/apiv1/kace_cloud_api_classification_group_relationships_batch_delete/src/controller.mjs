import { createSchema } from './schemas.mjs';
import { BaseController, HttpResponse } from '@kace/api-common';
import {
    ClassificationGroupBatchDeleter,
    IdsValidator,
    KnexClassificationGroupRelationshipRepository,
} from '@kace/core/src/classification-group-relationships';
import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexClassificationGroupRelationshipRepository(this.database_connection);
        this.started_at = new Date();
        this.repositoryClassification = new KnexClassificationRepository(knexConfig, readerConfig);
        this.repositoryGroups = new KnexGroupsRepository(this.database_connection);
        this.repositoryOneScript = new KnexOneScriptRepository(this.database_connection);
        this.idsValidationService = new IdsValidator(
            this.repositoryClassification,
            this.repositoryGroups,
            this.repositoryOneScript
        );
    }

    async destroyDbConnection() {
        await this.repositoryClassification.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'classification-group-relationships',
                'ClassificationGroupsRelationshipDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new ClassificationGroupBatchDeleter(this.repository).execute(data.value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
