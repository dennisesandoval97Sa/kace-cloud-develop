import ExecuteActionsOnCaseCreated from '@kace/core/src/cases/application/event-handlers/ExecuteActionsOnCaseCreated';
import ExecuteActionsOnCaseUpdated from '@kace/core/src/cases/application/event-handlers/ExecuteActionsOnCaseUpdated';
import { CaseCreated, KnexCaseRepository } from '@kace/core/src/cases/index.js';
import CaseUpdated from '@kace/core/src/cases/domain/events/CaseUpdated';
import { ActionExecutorFactory, KnexActionRepository } from '@kace/core/src/actions/index.js';
import { ActionExecutionDomainService } from '@kace/core/src/actions/domain/ActionExecutionDomainService.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

function buildCaseActionsHandler(userRepository, HandlerClass) {
    const actionExecutor = ActionExecutorFactory.createActionExecutor(userRepository.connection);
    const actionExecutionDomainService = new ActionExecutionDomainService(
        new KnexActionRepository(userRepository.connection),
        actionExecutor,
        new KnexCaseRepository(userRepository.connection)
    );
    return new HandlerClass(new KnexCaseRepository(userRepository.connection), actionExecutionDomainService);
}

const handlerFactories = new Map([
    [
        CaseCreated.EVENT_NAME,
        async ({ userRepository }, event) => {
            const h = buildCaseActionsHandler(userRepository, ExecuteActionsOnCaseCreated);
            await h.handle(event);
        },
    ],
    [
        CaseUpdated.EVENT_NAME,
        async ({ userRepository }, event) => {
            const h = buildCaseActionsHandler(userRepository, ExecuteActionsOnCaseUpdated);
            await h.handle(event);
        },
    ],
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'CasesEventProcessor',
});
