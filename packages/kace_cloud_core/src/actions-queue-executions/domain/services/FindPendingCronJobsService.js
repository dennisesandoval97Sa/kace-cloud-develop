import { ActionTriggers } from '../../../shared/domain/enum/ActionTriggersEnum';
import { StatusEnum } from '../enum/StatusEnum';

/**
 * Domain service to find all pending CRON_JOB executions
 */
export class FindPendingCronJobsService {
    /**
     * @param {KnexActionsQueueExecutionsRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * Executes a search for all pending executions with CRON_JOB trigger type.
     *
     * @returns {Promise<ActionsQueueExecutions[]>} List of pending executions of type CRON_JOB
     */
    async execute() {
        return this.repository.findByFilters({
            status: StatusEnum.PENDING.value,
            trigger_type: ActionTriggers.CRON_JOB.value,
        });
    }
}
