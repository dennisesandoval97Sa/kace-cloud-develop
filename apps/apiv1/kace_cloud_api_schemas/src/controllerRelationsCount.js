import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRelationsCountService } from '@kace/core/src/schemas/application/relations-count/SchemaRelationsCountService';
import { Helper } from '@kace/core/src/shared/index.js';

export class ControllerRelationsCount extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexSchemasRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'schemas', 'SchemasRelationsCount');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
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
            const response = await new SchemaRelationsCountService(this.repository).execute(id);
            return HttpResponse.ok({ ...response, event: this.event });
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
