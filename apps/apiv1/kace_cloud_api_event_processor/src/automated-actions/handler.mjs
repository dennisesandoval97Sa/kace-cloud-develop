import { AutomatedActionsRequested } from '@kace/core/src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';
import { ProcessActionQueueOnCronJobRequested } from '@kace/core/src/actions-queue-executions/application/event-handlers/ProcessActionQueueOnCronJobRequested.js';
import { KnexActionsQueueExecutionsRepository } from '@kace/core/src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js';
import { ActionQueueExecutor } from '@kace/core/src/actions-queue-executions/application/executor/ActionQueueExecutor.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const handlerFactories = new Map([
    [
        AutomatedActionsRequested.EVENT_NAME,
        async ({ userRepository }, event) => {
            const queueExecutionsRepository = new KnexActionsQueueExecutionsRepository(userRepository.connection);
            const actionQueueExecutor = new ActionQueueExecutor(queueExecutionsRepository);
            const h = new ProcessActionQueueOnCronJobRequested(actionQueueExecutor);
            await h.handle(event);
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'AutomatedActionsEventProcessor',
});
