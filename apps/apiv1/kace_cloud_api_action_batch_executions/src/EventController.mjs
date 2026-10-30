import { HttpResponse, ScheduleEventController } from '@kace/api-common';
import { JobQueueFactory, JobQueueProcessor } from '@kace/core/src/action-jobs/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';

export default class EventController extends ScheduleEventController {
    #jobExecutionQueueService;

    constructor(event, knexInstance) {
        super(event, knexInstance);
        this.#jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({
            knexInstance: this.database_connection,
        });
    }

    async actionDefault() {
        Helper.logInfo('Begin actionProcess');
        try {
            const wsRestflowSteprepository = new KnexWSRestWorkflowStepRepository(this.database_connection);
            const allowedConnectionRepository = new KnexAllowedConnectionsRepository(this.database_connection);
            const secretRepository = new KnexSecretsVaultRepository(this.database_connection);
            const workflowExecutor = new WorkflowExecutor(
                wsRestflowSteprepository,
                allowedConnectionRepository,
                secretRepository,
                this.user
            );

            const result = await new JobQueueProcessor(this.#jobExecutionQueueService, workflowExecutor).execute();
            return HttpResponse.ok({
                message: 'Procesamiento de cola iniciado correctamente',
                data: result.data,
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error en actionProcess:', error);
            return HttpResponse.internalServerError({
                message: 'Error processing batch executions',
                errors: error.message || 'Error al procesar la cola',
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionProcess');
        }
    }
}
