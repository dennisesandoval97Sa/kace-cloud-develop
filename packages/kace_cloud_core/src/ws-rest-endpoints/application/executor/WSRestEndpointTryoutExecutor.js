import { KnexWSRestEndpointRepository } from '../../infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexSecretsVaultRepository } from '../../../secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexAllowedConnectionsRepository } from '../../../allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { AxiosHttpClient } from '../../../shared/infrastructure/http/AxiosHttpClient.js';
import { SecretReplacer } from '../../../secrets-vault/index.js';
import { WorkflowStepExecutorService } from '../../../shared/domain/services/WorkflowStepExecutorService.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

/**
 * Executor to try a single `WSRestEndpoint` by id.
 *
 * Constructor receives a Knex connection instance. The `execute` method accepts
 * a single `id` and performs the real request (including secret replacement).
 */
export class WSRestEndpointTryoutExecutor {
    #connection;
    #endpointRepository;
    #secretRepository;
    #allowedConnectionRepository;
    #httpClient;
    #secretReplacer;

    constructor(connection) {
        if (!connection) {
            throw new Error('A Knex `connection` instance is required to construct WSRestEndpointTryoutExecutor');
        }

        this.#connection = connection;
        this.#endpointRepository = new KnexWSRestEndpointRepository(this.#connection);
        this.#secretRepository = new KnexSecretsVaultRepository(this.#connection);
        this.#allowedConnectionRepository = new KnexAllowedConnectionsRepository(this.#connection);

        this.#httpClient = new AxiosHttpClient(this.#allowedConnectionRepository);
        this.#secretReplacer = new SecretReplacer(this.#secretRepository);
    }

    /**
     * Execute the endpoint identified by `id`.
     * Optionally accepts an `initialContext` object to seed the workflow global context
     * before endpoint execution.
     * @param {string} id
     * @returns {Promise<Object>} HTTP response returned by `WorkflowStepExecutorService.executeEndpoint`
     */
    async execute(id, initialContext = {}) {
        Helper.logInfo(`Trying WSRestEndpoint id=${id}`);

        const wsEndpoint = await this.#endpointRepository.find(new ValueObjectUuid('id', id));

        if (!wsEndpoint) {
            throw new Error(`WSRestEndpoint with id ${id} not found`);
        }

        const dummyFinder = null;
        const dummyEventLogger = { log: async () => {} };
        const currentUser = { id: { value: 'tryout' } };

        const executorService = new WorkflowStepExecutorService(
            this.#httpClient,
            this.#secretReplacer,
            dummyFinder,
            dummyEventLogger,
            currentUser
        );

        let dbInitialContext = null;
        try {
            if (wsEndpoint && Object.prototype.hasOwnProperty.call(wsEndpoint, 'initial_context')) {
                dbInitialContext = wsEndpoint.initial_context?.value ?? wsEndpoint.initial_context;
            } else if (wsEndpoint && typeof wsEndpoint.toJson === 'function') {
                const json = wsEndpoint.toJson();
                dbInitialContext = json.initial_context ?? json.initialContext ?? null;
            }
        } catch (err) {
            Helper.logInfo('Could not extract initial_context from wsEndpoint', err);
            dbInitialContext = null;
        }

        if (dbInitialContext && Object.keys(dbInitialContext).length > 0) {
            if (typeof executorService.addInitialContext === 'function') {
                executorService.addInitialContext(dbInitialContext);
            }
        }

        if (initialContext && Object.keys(initialContext).length > 0) {
            if (typeof executorService.addInitialContext === 'function') {
                executorService.addInitialContext(initialContext);
            }
        }

        const { result } = await executorService.executeEndpoint(wsEndpoint, { processResponse: false });

        Helper.logInfo(`Response status ${result?.status} for endpoint ${id}`);

        return result;
    }
}
