import { ActionJobProcessingQueueService } from '../domain/services/ActionJobProcessingQueueService.js';
import { ActionJobProcessingProcessor } from '../application/process/ActionJobProcessingProcessor.js';
import { KnexActionJobProcessingRepository } from './KnexActionJobProcessingRepository.js';
import { KnexActionJobRepository } from '../../action-jobs/infrastructure/KnexActionJobRepository.js';
import { ActionExecutorFactory, KnexActionRepository } from '../../actions/index.js';
import { KnexCaseRepository } from '../../cases/index.js';

export class ActionJobProcessingFactory {
    static createActionJobProcessingProcessor({ connection, maxRetries = 3, concurrencyLimit = 10 }) {
        const actionExecutionRepository = new KnexActionJobProcessingRepository(connection);
        const actionJobRepository = new KnexActionJobRepository(connection);
        const actionRepository = new KnexActionRepository(connection);
        const caseRepository = new KnexCaseRepository(connection);
        const actionExecutor = new ActionExecutorFactory(connection);

        const actionExecutionQueueService = new ActionJobProcessingQueueService({
            actionExecutionRepository,
            actionJobRepository,
            actionExecutor,
            actionRepository,
            caseRepository,
            maxRetries,
            concurrencyLimit,
        });

        return new ActionJobProcessingProcessor({ actionExecutionQueueService });
    }
}
