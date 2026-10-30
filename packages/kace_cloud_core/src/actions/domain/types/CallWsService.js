import { Case } from '../../../cases/index.js';
import { Action } from '../../domain/Action.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { DomainWSRestFlowFinder, WSRestFlow } from '../../../ws-rest-flows/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { WSRestWorkflowStepFinderService } from '../../../ws-rest-workflow-step/domain/services/WSRestWorkflowStepFinderService.js';
import { SecretReplacer } from '../../../secrets-vault/index.js';
import { WorkflowStepExecutorService } from '../../../shared/domain/services/WorkflowStepExecutorService.js';
import { AxiosHttpClient } from '../../../shared/infrastructure/http/AxiosHttpClient.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { KnexEndpointTokenCacheRepository } from '../../../ws-rest-endpoints/infrastructure/persistence/KnexEndpointTokenCacheRepository.js';
import { EndpointTokenCacheService } from '../../../ws-rest-endpoints/domain/services/EndpointTokenCacheService.js';

export class CallWsService {
    /**
     * Creates an instance of `AssignUserByExternalCodeCase`.
     *
     * @param {KnexCaseRepository} repository - Repository for managing entity operations.
     * @param {KnexWSRestFlowRepository} wsRestFlowRepository - Repository for managing rest flow operations.
     * @param {KnexWSRestWorkflowStepRepository} wsRestWorkflowStepRepository - Repository for managing workflow step operations.
     * @param {KnexSecretsVaultRepository} secretRepository - Repository for managing secrets vault operations.
     * @param {KnexAllowedConnectionsRepository} allowedConnectionRepository - Repository for managing allowed connections.
     * @param {?Object} [content] - The content to be used in the workflow execution.
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     */
    constructor(
        repository,
        wsRestFlowRepository,
        wsRestWorkflowStepRepository,
        secretRepository,
        allowedConnectionRepository,
        currentUser,
        content = {}
    ) {
        this.repository = repository;
        this.content = content;
        this.domainWSRestFlowFinder = new DomainWSRestFlowFinder(wsRestFlowRepository);

        const wsRestStepsFinder = new WSRestWorkflowStepFinderService(wsRestWorkflowStepRepository);
        const httpClient = new AxiosHttpClient(allowedConnectionRepository);
        const secretReplacer = new SecretReplacer(secretRepository);
        const endpointTokenCacheRepo = new KnexEndpointTokenCacheRepository(repository.connection);
        const endpointTokenCacheService = new EndpointTokenCacheService(endpointTokenCacheRepo);

        this.workflowExecutorService = new WorkflowStepExecutorService(
            httpClient,
            secretReplacer,
            wsRestStepsFinder,
            new EventLogger(repository),
            currentUser,
            endpointTokenCacheService
        );
    }

    /**
     * Executes the workflow step for the given action.
     *
     * @param {Aggregate} entity - The entity aggregate to be executed.
     * @param {Action} action - The action containing the workflow step to be executed
     *
     * @returns {Promise<boolean>} - Returns `true` if the workflow step was executed successfully, otherwise `false`.
     */
    async execute(entity, action) {
        try {
            const wsRestFlow = await this.domainWSRestFlowFinder.execute(action.ws_rest_flow_id.value);
            if (!wsRestFlow || !(wsRestFlow instanceof WSRestFlow) || wsRestFlow.isDeleted()) {
                Helper.logDebug(
                    'No workflow steps found for the provided flow identifier:',
                    action.ws_rest_flow_id.value
                );
                return false;
            }

            if (action.entity && action.entity.value !== 'case') {
                this.content = {
                    ...this.content,
                    [action.entity.value]: entity.toJson(),
                };
                Helper.logDebug('new context for restFlow:', this.content);
            } else {
                if (!(entity instanceof Case)) {
                    throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
                }
                if (!(action instanceof Action)) {
                    throw new InvalidArgumentError('The provided entity is not a valid instance of "Action".');
                }

                const caseInfo = await this.repository.getCaseInformationWithRelations(entity.id);
                this.content = {
                    ...this.content,
                    ...caseInfo,
                };
                Helper.logDebug('new context for restFlow:', this.content);
            }

            await this.workflowExecutorService.execute(
                { flow_id: wsRestFlow.id.value, initial_context: this.content },
                'action'
            );

            return true;
        } catch (error) {
            const isEmptyFlow =
                error instanceof InvalidArgumentError &&
                error.message === 'No workflow steps found for the provided flow identifier.';
            if (isEmptyFlow) {
                Helper.logInfo('CallWsService: skipping action — wsRestFlow has no steps configured', {
                    actionId: action?.id?.value,
                    actionDescription: action?.description?.value,
                    wsRestFlowId: action?.ws_rest_flow_id?.value,
                });
            } else {
                Helper.logError('Error al ejecutar el restFlow:', error);
            }
            return false;
        }
    }
}
