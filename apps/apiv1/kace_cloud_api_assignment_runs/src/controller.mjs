import { BaseController, HttpResponse, SearchSchema } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { ValidationFailError } from '@kace/core/src/shared/errors/ValidationFailError.js';
import { KnexAutomatedAssignmentRunsRepository } from '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js';
import { AutomatedAssignmentRunSearcher } from '@kace/core/src/automated-assignment-runs/application/search/AutomatedAssignmentRunSearcher.js';
import { AutomatedAssignmentRunFinder } from '@kace/core/src/automated-assignment-runs/application/find/AutomatedAssignmentRunFinder.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Configs crudos (no this.database_connection) para no colapsar el reader en el writer.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAutomatedAssignmentRunsRepository(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'assignment-runs', 'AssignmentRunsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to view assignment runs.',
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

            const response = await new AutomatedAssignmentRunFinder(this.repository).execute(id);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof ValidationFailError) {
                return HttpResponse.notFound({ message: 'AutomatedAssignmentRun not found', event: this.event });
            }
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'assignment-runs', 'AssignmentRunsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const searcher = new AutomatedAssignmentRunSearcher(this.repository);
            const response = await searcher.execute(data.value);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
