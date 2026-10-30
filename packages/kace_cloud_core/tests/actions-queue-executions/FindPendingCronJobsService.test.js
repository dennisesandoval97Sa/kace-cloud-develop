import { knexConfig } from '../knexfile.js';
import { KnexActionsQueueExecutionsRepository } from '../../src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository';
import { FindPendingCronJobsService } from '../../src/actions-queue-executions/domain/services/FindPendingCronJobsService.js';
import { ActionTriggers } from '../../src/shared/domain/enum/ActionTriggersEnum.js';
import { StatusEnum } from '../../src/actions-queue-executions/domain/enum/StatusEnum.js';
import { ActionsQueueExecutionsMother } from './domain/ActionsQueueExecutionsMother.js';

describe('FindPendingCronJobsService', () => {
    const repository = new KnexActionsQueueExecutionsRepository(knexConfig);
    const service = new FindPendingCronJobsService(repository);

    beforeEach(async () => {
        await repository.connection('actions_queue_executions').truncate();
    });

    it('should find pending CRON_JOB executions', async () => {
        const pendingCronJobExecution = await ActionsQueueExecutionsMother.create(repository, {
            trigger: ActionTriggers.CRON_JOB.value,
            status: StatusEnum.PENDING.value,
        });

        const pendingCronJobExecution2 = await ActionsQueueExecutionsMother.create(repository, {
            trigger: ActionTriggers.CRON_JOB.value,
            status: StatusEnum.PENDING.value,
        });

        await ActionsQueueExecutionsMother.create(repository, {
            trigger: ActionTriggers.CRON_JOB.value,
            status: StatusEnum.COMPLETED.value,
        });

        const pendingCronJobs = await service.execute();

        expect(pendingCronJobs).toHaveLength(2);

        const foundIds = pendingCronJobs.map((job) => job.id.value);
        expect(foundIds).toContain(pendingCronJobExecution.id.value);
        expect(foundIds).toContain(pendingCronJobExecution2.id.value);

        expect(pendingCronJobs[0].status.value).toEqual(StatusEnum.PENDING.value);
        expect(pendingCronJobs[1].status.value).toEqual(StatusEnum.PENDING.value);

        expect(pendingCronJobs[0].trigger_type.value).toEqual(ActionTriggers.CRON_JOB.value);
        expect(pendingCronJobs[1].trigger_type.value).toEqual(ActionTriggers.CRON_JOB.value);
    });

    it('should return an empty array if no pending CRON_JOB executions are found', async () => {
        await ActionsQueueExecutionsMother.create(repository, {
            trigger: ActionTriggers.CRON_JOB.value,
            status: StatusEnum.COMPLETED.value,
        });

        const pendingCronJobs = await service.execute();

        expect(pendingCronJobs).toHaveLength(0);
    });
});
