import { ActionJobCreated } from '@kace/core/src/action-jobs/domain/events/ActionJobCreated.js';
import { ProcessJobOnActionJobCreated } from '@kace/core/src/action-jobs/application/event-handlers/ProcessJobOnActionJobCreated.js';
import { JobQueueFactory } from '@kace/core/src/action-jobs/infrastructure/JobQueueFactory.js';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const handlerFactories = new Map([
    [
        ActionJobCreated.EVENT_NAME,
        async ({ userRepository }, event) => {
            const knexInstance = userRepository.connection;
            const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({ knexInstance });

            const userId = event.metadata?.user_id;
            const currentUser = userId ? await userRepository.find({ value: userId }) : null;

            const workflowExecutor = new WorkflowExecutor(
                new KnexWSRestWorkflowStepRepository(knexInstance),
                new KnexAllowedConnectionsRepository(knexInstance),
                new KnexSecretsVaultRepository(knexInstance),
                currentUser
            );
            const h = new ProcessJobOnActionJobCreated(jobExecutionQueueService, workflowExecutor);
            await h.handle(event);
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'ActionJobsEventProcessor',
});
