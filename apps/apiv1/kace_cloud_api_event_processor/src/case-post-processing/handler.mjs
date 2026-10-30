import CasePostProcessingOnCaseCreated from '@kace/core/src/cases/application/event-handlers/CasePostProcessingOnCaseCreated.js';
import { CasePostProcessingRequested, KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const handlerFactories = new Map([
    [
        CasePostProcessingRequested.EVENT_NAME,
        async ({ userRepository }, event) => {
            const h = new CasePostProcessingOnCaseCreated(new KnexCaseRepository(userRepository.connection));
            await h.handle(event);
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'CasePostProcessingEventProcessor',
});
