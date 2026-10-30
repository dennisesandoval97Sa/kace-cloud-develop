import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';
import { ChannelHubPayloadBuilder } from '../../infrastructure/mappers/ChannelHubPayloadBuilder.js';
import { TenantContext } from '../../../shared/infrastructure/context/TenantContext.js';
import { Helper } from '../../../shared/index.js';

export class ChannelHubAccountRegistrar {
    #repository;
    #finder;
    #workflowExecutor;
    #registrationFlowValidator;

    constructor(repository, workflowExecutor, registrationFlowValidator) {
        this.#repository = repository;
        this.#finder = new DomainFinder(repository);
        this.#workflowExecutor = workflowExecutor;
        this.#registrationFlowValidator = registrationFlowValidator;
    }

    async execute(id, currentUserId) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('Channel Hub account not found', 404);
        }

        if (account.channel_hub_connection_id.value) {
            throw new CustomError('This account is already registered in Channel Hub', 409);
        }

        await this.#registrationFlowValidator.execute(account.rest_flow_id);

        const tenant = TenantContext.getTenant();
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(tenant, account);
        const initial_context = {
            channel_hub: {
                ...payload,
                connection_id: account.channel_hub_connection_id.value,
            },
        };

        const logContext = { accountId: account.id.value };
        Helper.logDebug('ChannelHubAccountRegistrar::BeginWorkflowExecution::InitialContext', logContext);

        const response = await this.#workflowExecutor.execute({
            flow_id: account.rest_flow_id.value,
            initial_context,
        });

        const responseJson = response.toJson();
        const connectionResponse = responseJson?.data?.context?.channel_hub?.connection_response;
        Helper.logDebug('ChannelHubAccountRegistrar::BeginWorkflowExecution::Response', {
            ...logContext,
            hasConnectionResponse: Boolean(connectionResponse),
            statusCode: connectionResponse?.statusCode ?? null,
            hasConnectionId: Boolean(connectionResponse?.connection?.id),
        });

        const now = new Date();

        if (connectionResponse?.statusCode && connectionResponse.statusCode === 400) {
            Helper.logError('ChannelHubAccountRegistrar::WorkflowExecution::Response::Error', {
                ...logContext,
                statusCode: connectionResponse.statusCode,
            });

            await this.#repository.updateConnectionId(account.id.value, null, connectionResponse, now, currentUserId);

            throw new CustomError('Channel Hub registration failed', 400);
        }

        const connectionId = connectionResponse?.connection?.id;
        if (!connectionId) {
            throw new CustomError('Channel Hub did not return a connection id', 500);
        }

        const affectedRows = await this.#repository.updateConnectionId(
            account.id.value,
            connectionId,
            null,
            now,
            currentUserId
        );

        if (affectedRows === 0) {
            throw new CustomError('Account was already registered by another request', 409);
        }
    }
}
