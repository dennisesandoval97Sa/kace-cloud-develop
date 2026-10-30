import { JobExecutionQueueService } from '../domain/services/JobExecutionQueueService.js';
import { KnexActionJobRepository } from './KnexActionJobRepository.js';
import { ActionExecutorFactory } from '../../actions/infrastructure/ActionExecutorFactory.js';
import { ActionJobProcessingQueueService } from '../../action-job-processing/domain/services/ActionJobProcessingQueueService.js';
import { KnexActionJobProcessingRepository } from '../../action-job-processing/index.js';
import { KnexCaseRepository } from '../../cases/index.js';
import { KnexClientRepository } from '../../clients/index.js';
import { KnexActionRepository } from '../../actions/index.js';
import { KnexActionUpdateModelRepository } from '../../action-update-model/index.js';
import { Mail } from '../../mails/index.js';
import { KnexUsersRepository } from '../../users/index.js';
import { KnexGroupsRepository } from '../../grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../global-config/index.js';
import { KnexMailAccountRepository } from '../../mail-accounts/index.js';

export class JobQueueFactory {
    static createJobExecutionQueueService({ knexInstance, maxRetries = 3, concurrencyLimit = 10, batchSize = 25 }) {
        const actionJobRepository = new KnexActionJobRepository(knexInstance);
        const actionExecutionRepository = new KnexActionJobProcessingRepository(knexInstance);
        const actionExecutor = ActionExecutorFactory.createActionExecutor(knexInstance);

        const clientModelUpdater = ActionExecutorFactory.createClientModelUpdater(knexInstance);
        const caseRepository = new KnexCaseRepository(knexInstance);
        const clientRepository = new KnexClientRepository(knexInstance);
        const actionRepository = new KnexActionRepository(knexInstance);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(knexInstance);
        const usersRepository = new KnexUsersRepository(knexInstance);
        const groupsRepository = new KnexGroupsRepository(knexInstance);
        const globalConfigurationRepository = new KnexGlobalConfigurationRepository(knexInstance);
        const mailAccountRepository = new KnexMailAccountRepository(knexInstance);

        const actionExecutionProcessor = new ActionJobProcessingQueueService({
            actionExecutionRepository,
            actionJobRepository,
            actionExecutor,
            clientModelUpdater,
            caseRepository,
            clientRepository,
            actionRepository,
            actionUpdateModelRepository,
            usersRepository,
            groupsRepository,
            globalConfigurationRepository,
            mailAccountRepository,
            maxRetries,
            concurrencyLimit,
            batchSize,
        });

        return new JobExecutionQueueService({
            actionJobRepository,
            actionExecutionProcessor,
            actionExecutionRepository,
            caseRepository,
        });
    }

    static Mail() {
        const dto = {
            id: mailAccount.id.value,
            mail_account_id: mailAccount.id.value,
            to: [template.destinatario.value],
            subject: 'Subject of the Email',
            content: 'This is the content of the email',
            sent_status: 'PENDING',
            created_at: new Date(),
            created_by: caseEntity.created_by.value,
        };

        return Mail.create(dto);
    }
}
