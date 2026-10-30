import { KnexActionUpdateModelRepository } from '../../action-update-model';
import { KnexAllowedConnectionsRepository } from '../../allowed-conections';
import { KnexAuxCasesRepository } from '../../aux_casos';
import { KnexAuxClientsRepository } from '../../aux_clientes';
import { KnexCaseRepository } from '../../cases';
import { KnexCaseAttachmentRepository } from '../../case-attachments';
import { KnexClassificationRepository } from '../../classifications';
import { KnexClientRepository } from '../../clients';
import { KnexGlobalConfigurationRepository } from '../../global-config';
import { KnexGroupsRepository } from '../../grupos';
import { KnexMailAccountRepository } from '../../mail-accounts';
import { KnexSecretsVaultRepository } from '../../secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { KnexStateRepository } from '../../state';
import { KnexTemplatesRepository } from '../../templates';
import { KnexTransitionsRepository } from '../../transition';
import { KnexUsersRepository } from '../../users';
import { KnexWSRestFlowRepository } from '../../ws-rest-flows';
import { KnexWSRestWorkflowStepRepository } from '../../ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import { KnexSubcaseRelationshipRepository } from '../../cases';
import { KnexUserListsRepository } from '../../user-lists/index';

import { FormulaEvaluator } from '../domain/FormulaEvaluator';
import { ModelValueSaver } from '../domain/ModelValueSaver';
import { ClientModelUpdater } from '../domain/types/ClientModelUpdater';
import { ActionExecutor } from '../../shared/domain/services/ActionExecutor.js';

export class ActionExecutorFactory {
    /**
     * Constructor for ActionExecutorWithConnection class.
     * @param {Knex} connection - The central connection object (e.g., `caseRepository.connection`).
     * @return {ActionExecutor}
     */
    static createActionExecutor(connection) {
        return new ActionExecutor(
            new KnexCaseRepository(connection),
            new KnexUsersRepository(connection),
            new KnexGroupsRepository(connection),
            new KnexClassificationRepository(connection),
            new KnexTemplatesRepository(connection),
            new KnexMailAccountRepository(connection),
            new KnexActionUpdateModelRepository(connection),
            new KnexWSRestFlowRepository(connection),
            new KnexGlobalConfigurationRepository(connection),
            new KnexClientRepository(connection),
            new KnexAuxCasesRepository(connection),
            new KnexAuxClientsRepository(connection),
            new KnexSecretsVaultRepository(connection),
            new KnexAllowedConnectionsRepository(connection),
            new KnexWSRestWorkflowStepRepository(connection),
            new KnexSubcaseRelationshipRepository(connection),
            new KnexUserListsRepository(connection),
            new KnexCaseAttachmentRepository(connection),
            new KnexStateRepository(connection),
            new KnexTransitionsRepository(connection)
        );
    }

    static createClientModelUpdater(connection) {
        const caseRepository = new KnexCaseRepository(connection);
        const clientRepository = new KnexClientRepository(connection);
        const auxCasesRepository = new KnexAuxCasesRepository(connection);
        const auxClientsRepository = new KnexAuxClientsRepository(connection);
        const groupsRepository = new KnexGroupsRepository(connection);
        const globalConfigurationRepository = new KnexGlobalConfigurationRepository(connection);
        const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(connection);

        const formulaEvaluator = new FormulaEvaluator(
            caseRepository,
            clientRepository,
            auxCasesRepository,
            auxClientsRepository
        );
        const modelValueSaver = new ModelValueSaver(
            caseRepository,
            clientRepository,
            auxCasesRepository,
            auxClientsRepository,
            groupsRepository,
            globalConfigurationRepository,
            subcaseRelationshipRepository
        );
        return new ClientModelUpdater(formulaEvaluator, modelValueSaver);
    }
}
