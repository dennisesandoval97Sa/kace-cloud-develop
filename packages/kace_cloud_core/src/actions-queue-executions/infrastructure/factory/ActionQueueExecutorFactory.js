import { KnexActionRepository } from '../../../actions/infrastructure/KnexActionRepository';
import { KnexCaseRepository } from '../../../cases/infrastructure/persistence/KnexCaseRepository';
import { KnexActionsQueueExecutionsRepository } from '../persistence/KnexActionsQueueExecutionsRepository';

import { FindPendingCronJobsService } from '../../domain/services/FindPendingCronJobsService';
import { ActionFinder as DomainActionFinder } from '../../../actions/domain/ActionFinder';
import { CaseFinder as DomainCaseFinder } from '../../../cases/domain/CaseFinder';
import { ActionExecutorFactory } from '../../../actions/infrastructure/ActionExecutorFactory';
import { BackgroundExecutionService } from '../../../shared/domain/services/background-execution/BackgroundExecutionService';
import { ActionQueueExecutorService } from '../../domain/services/ActionQueueExecutorService';
import { KnexBackgroundExecutionRepository } from '../../../background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository';

/**
 * Factory creating ActionQueueExecutorService instance with all dependencies
 */
export class ActionQueueExecutorFactory {
    /**
     * Create an instance of ActionQueueExecutorService with all dependencies
     *
     * @param {Knex} connection The central connection object (e.g., `caseRepository.connection`).
     *
     * @returns {ActionQueueExecutorService} Instance of the service configured
     */
    static createActionQueueExecutorService(connection) {
        const actionsQueueExecutionsRepository = new KnexActionsQueueExecutionsRepository(connection);
        const actionRepository = new KnexActionRepository(connection);
        const caseRepository = new KnexCaseRepository(connection);
        const backgroundExecutionRepository = new KnexBackgroundExecutionRepository(connection);

        const findPendingCronJobsService = new FindPendingCronJobsService(actionsQueueExecutionsRepository);
        const actionFinder = new DomainActionFinder(actionRepository);
        const caseFinder = new DomainCaseFinder(caseRepository);
        const actionExecutor = ActionExecutorFactory.createActionExecutor(connection);
        const backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);

        return new ActionQueueExecutorService({
            findPendingCronJobsService,
            actionFinder,
            caseFinder,
            actionExecutor,
            backgroundExecutionService,
            repository: actionsQueueExecutionsRepository,
        });
    }
}
