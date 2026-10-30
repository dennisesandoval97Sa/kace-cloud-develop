import { WorkflowExecutor } from '../../../clients';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { MAIL_ACCOUNT_HOST_NOT_ALLOWED } from '@kace/error-codes';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainMailAccountFinder } from '../../index.js';
import { Helper, TenantContext } from '../../../shared/index.js';
import { ChannelHubPayloadBuilder } from '../../../channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class MailAccountUpdater {
    /** @type {DomainMailAccountFinder} is initialized in the constructor */
    #mailAccountFinder;
    /** @type {KnexMailAccountRepository} is initialized in the constructor */
    #repository;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #groupsRepository;
    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor */
    #globalConfigRepository;
    /** @type {WorkflowExecutor} is initialized in the constructor */
    #workflowExecutor;

    constructor(
        repository,
        groupsRepository,
        globalConfigRepository,
        workflowStepRepository,
        allowedConnectionRepository,
        secretRepository,
        currentUser
    ) {
        this.#repository = repository;
        this.#mailAccountFinder = new DomainMailAccountFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#groupsRepository = groupsRepository;
        this.#globalConfigRepository = globalConfigRepository;
        this.#workflowExecutor = new WorkflowExecutor(
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );
    }
    /**
     * Updates an MailAccount object in the repository.
     *
     * @param {string} id - The unique identifier of the MailAccount object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the MailAccount object.
     * @returns {Promise<void>} A promise that resolves when the MailAccount object is updated.
     */
    async execute(id, dto, idGrupoActivo) {
        const mailAccount = await this.#mailAccountFinder.execute(id);

        if (!mailAccount) {
            throw new CustomError('The mail account you are trying update does not exist', 404);
        }

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }
        if (dto.host) {
            await this.validateHost(dto.host);
        }

        if (dto.register_in_channel_hub) {
            const restflowConfig = await this.#restflowCreateAccountChannelhub(idGrupoActivo);

            const accountChannelHubFlowId = restflowConfig
                ? restflowConfig.settings.behaviors.configurations.application.agente?.channel_hub
                      ?.account_channel_hub_flow_id
                : undefined;
            if (restflowConfig && accountChannelHubFlowId) {
                const tenant = TenantContext.getTenant();
                const initial_context = {
                    channel_hub: {
                        ...ChannelHubPayloadBuilder.buildConnectionPayload(tenant, mailAccount),
                        connection_id: mailAccount.channel_hub_connection_id.value,
                    },
                };
                Helper.logDebug('MailAccountCreator::BeginWorkflowExecution::InitialContext', initial_context);

                const response = await this.#workflowExecutor.execute({
                    flow_id: accountChannelHubFlowId,
                    initial_context,
                });
                Helper.logDebug('MailAccountCreator::BeginWorkflowExecution::Response', response.toJson());

                const connectionResponse = response.toJson()?.data?.context?.channel_hub?.connection_response;
                if (connectionResponse?.statusCode && connectionResponse.statusCode === 400) {
                    Helper.logError('MailAccountCreator::WorkflowExecution::Response::Error', connectionResponse);
                    mailAccount.channel_hub_error.value = connectionResponse;
                    mailAccount.channel_hub_connection_id.value = null;
                }

                if (connectionResponse?.connection?.id) {
                    mailAccount.channel_hub_connection_id.value = connectionResponse.connection.id;
                }
            }
        }

        const originalValues = mailAccount.toJson();
        mailAccount.update(dto);

        await this.#repository.update(mailAccount);
        await this.#repository.saveHistory(mailAccount, originalValues);

        mailAccount.flushChanges();
    }

    async validateHost(host) {
        if (!(await this.#repository.isAllowedConnection(host))) {
            throw new CustomError(`Host '${host}' is not allowed.`, 400, null, MAIL_ACCOUNT_HOST_NOT_ALLOWED);
        }
    }

    async #restflowCreateAccountChannelhub(idGrupoActivo) {
        if (!idGrupoActivo) {
            return null;
        }

        const group = await this.#groupsRepository.find(new ValueObjectUuid('id', idGrupoActivo));
        if (!group || !group.account_channel_hub_flow_id) {
            return null;
        }

        const config = await this.#globalConfigRepository.find(group.configuration_id);
        return config || null;
    }
}
