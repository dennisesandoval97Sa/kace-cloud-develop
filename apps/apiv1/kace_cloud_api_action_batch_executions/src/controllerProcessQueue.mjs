import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import { JobQueueProcessor, JobQueueFactory } from '@kace/core/src/action-jobs';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';

export class ControllerProcessQueue extends BaseController {
    #jobExecutionQueueService;

    constructor(event, knexInstance) {
        super(event, knexInstance);
        this.#jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({
            knexInstance: this.database_connection,
        });
    }

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin ControllerProcessQueue::actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'action-jobs', 'ActionJobsProcessQueue');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to process the action jobs queue.',
                    event: this.event,
                });
            }

            const wsRestflowSteprepository = new KnexWSRestWorkflowStepRepository(this.database_connection);
            const allowedConnectionRepository = new KnexAllowedConnectionsRepository(this.database_connection);
            const secretRepository = new KnexSecretsVaultRepository(this.database_connection);
            const workflowExecutor = new WorkflowExecutor(
                wsRestflowSteprepository,
                allowedConnectionRepository,
                secretRepository,
                this.user
            );

            this.#authorizeSearch('action-batch-executions.process-queue.search', {});
            const result = await new JobQueueProcessor(this.#jobExecutionQueueService, workflowExecutor).execute();

            return HttpResponse.ok({
                message: 'Procesamiento de cola iniciado correctamente',
                data: result.data,
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError('Error en ControllerProcessQueue::actionSearch:', error);
            return HttpResponse.internalServerError({
                message: 'Error processing batch executions',
                errors: error.message || 'Error al procesar la cola',
                event: this.event,
            });
        } finally {
            Helper.logInfo('End ControllerProcessQueue::actionSearch');
        }
    }
}
