import { WorkflowStepExecutorService } from '../../../shared/domain/services/WorkflowStepExecutorService.js';
import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';

import { AxiosHttpClient } from '../../../shared/infrastructure/http/AxiosHttpClient.js';
import { SecretReplacer } from '../../../secrets-vault/index.js';
import { WorkflowExecutorResponse } from './WorkflowExecutorResponse.js';
import { Helper } from '../../../shared/index.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { KnexEndpointTokenCacheRepository } from '../../../ws-rest-endpoints/infrastructure/persistence/KnexEndpointTokenCacheRepository.js';
import { EndpointTokenCacheService } from '../../../ws-rest-endpoints/domain/services/EndpointTokenCacheService.js';

/**
 * Application service responsible for executing a complete workflow by identifying it
 * through either flow ID or external code.
 * This orchestrates:
 * 1. Finding all workflow steps for a flow
 * 2. Executing them in the correct order
 * 3. Handling global context between steps
 * 4. Processing response data
 */
export class WorkflowExecutor {
    /**
     * @type {WorkflowStepExecutorService}
     */
    #executorService;
    /**
     * @param {KnexWSRestWorkflowStepRepository} repository
     * @param {KnexAllowedConnectionsRepository} allowedConnectionRepository
     * @param {KnexSecretsVaultRepository} secretRepository
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     * @param {{failOnHttpError?: boolean, requestTimeoutMs?: number, requestTimeoutResolver?: null|(() => number)}} [options] - Per-execution HTTP policy.
     */
    constructor(repository, allowedConnectionRepository, secretRepository, currentUser, options = {}) {
        const finderService = new WSRestWorkflowStepFinderService(repository);
        const httpClient = new AxiosHttpClient(allowedConnectionRepository);
        const secretReplacer = new SecretReplacer(secretRepository);
        const endpointTokenCacheRepo = new KnexEndpointTokenCacheRepository(repository.connection);
        const endpointTokenCacheService = new EndpointTokenCacheService(endpointTokenCacheRepo);
        this.#executorService = new WorkflowStepExecutorService(
            httpClient,
            secretReplacer,
            finderService,
            new EventLogger(repository),
            currentUser,
            endpointTokenCacheService,
            options
        );
    }

    /**
     * Execute a workflow by flow ID or external code
     *
     * @param {Object} dto
     * @param {?string} [dto.flow_id] - Flow ID to identify the workflow
     * @param {?string} [dto.external_code] - External code to identify the workflow
     * @param {?Object} [dto.initial_context] - Initial global context data
     *
     * @returns {Promise<WorkflowExecutorResponse>}
     */
    async execute(dto = {}) {
        Helper.logDebug('DTO Recibido', JSON.stringify(dto));
        return new WorkflowExecutorResponse(await this.#executorService.execute(dto, 'webhook'));
    }
}
