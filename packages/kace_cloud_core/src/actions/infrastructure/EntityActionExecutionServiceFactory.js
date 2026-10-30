import { KnexActionRepository } from '../index.js';
import { KnexUsersRepository } from '../../users/index.js';
import { KnexGroupsRepository } from '../../grupos/index.js';
import { KnexClientRepository } from '../../clients/index.js';
import { KnexTemplatesRepository } from '../../templates/index.js';
import { KnexMailAccountRepository } from '../../mail-accounts/index.js';
import { KnexWSRestFlowRepository } from '../../ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexSecretsVaultRepository } from '../../secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexAllowedConnectionsRepository } from '../../allowed-conections/index.js';
import { KnexGlobalConfigurationRepository } from '../../global-config/index.js';
import { EntityActionExecutor } from '../../shared/domain/services/EntityActionExecutor.js';
import { EntityActionExecutionService } from '../../shared/domain/services/EntityActionExecutionService.js';
import { EntityActionValidator } from '../../shared/domain/services/EntityActionValidator.js';
import { EntityRulesContextResolver } from '../../shared/domain/services/EntityRulesContextResolver.js';

/**
 * Factory for creating EntityActionExecutionService instances
 * This factory belongs to the actions infrastructure layer as it handles action-specific service creation
 */
export class EntityActionExecutionServiceFactory {
    /**
     * Create an EntityActionExecutionService with all required dependencies
     *
     * @param {KnexUsersRepository|KnexGroupsRepository} entityRepository - The repository for the entity
     * @returns {EntityActionExecutionService}
     */
    static create(entityRepository) {
        const actionRepository = new KnexActionRepository(entityRepository.connection);
        const userRepository = new KnexUsersRepository(entityRepository.connection);
        const groupRepository = new KnexGroupsRepository(entityRepository.connection);
        const clientRepository = new KnexClientRepository(entityRepository.connection);
        const templatesRepository = new KnexTemplatesRepository(entityRepository.connection);
        const mailAccountRepository = new KnexMailAccountRepository(entityRepository.connection);
        const wsRestFlowRepository = new KnexWSRestFlowRepository(entityRepository.connection);
        const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(entityRepository.connection);
        const secretRepository = new KnexSecretsVaultRepository(entityRepository.connection);
        const allowedConnectionRepository = new KnexAllowedConnectionsRepository(entityRepository.connection);
        const globalConfigurationRepository = new KnexGlobalConfigurationRepository(entityRepository.connection);

        const executor = new EntityActionExecutor({
            userRepository,
            groupRepository,
            clientRepository,
            templatesRepository,
            mailAccountRepository,
            wsRestFlowRepository,
            wsRestWorkflowStepRepository,
            secretRepository,
            allowedConnectionRepository,
        });

        const contextResolver = new EntityRulesContextResolver({
            groupsRepository: groupRepository,
            globalConfigurationRepository,
        });

        const validator = new EntityActionValidator(contextResolver);

        return new EntityActionExecutionService(actionRepository, executor, validator);
    }
}
