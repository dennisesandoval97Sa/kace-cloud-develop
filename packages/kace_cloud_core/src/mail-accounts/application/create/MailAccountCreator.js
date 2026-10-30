import { WorkflowExecutor } from '../../../ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import { CustomError } from '../../../shared/errors/CustomError';
import { MAIL_ACCOUNT_HOST_NOT_ALLOWED } from '@kace/error-codes';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { MailAccountFinder as DomainMailAccountFinder } from '../../domain/MailAccountFinder.js';
import { MailAccount } from '../../domain/MailAccount.js';
import { TenantContext } from '../../../shared/infrastructure/context/TenantContext.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { ChannelHubPayloadBuilder } from '../../../channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js';
import { Helper } from '../../../shared/index.js';

export class MailAccountCreator {
    /** @type {KnexMailAccountRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainMailAccountFinder} is initialized in the constructor */
    #finder;
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
        this.#finder = new DomainMailAccountFinder(repository);
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
     * Executes the creation of an MailAccount object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the MailAccount object.
     * @param {string} idGrupoActivo
     * @returns {Promise<void>} A promise that resolves when the MailAccount object is saved.
     */
    async execute(dto, idGrupoActivo) {
        const mailAccount = MailAccount.create(dto);

        const result = await this.#finder.execute(mailAccount.id.value);
        if (result) {
            throw new CustomError(`Mail Account with id ${mailAccount.id.value} already exists`, 400);
        }

        if (mailAccount.host.value) {
            await this.validateHost(mailAccount.host.value);
        }

        await this.#uniquenessValidator.validate('description', dto.description);

        if (dto.register_in_channel_hub) {
            await this.setupChannelHubAccount(idGrupoActivo, mailAccount);
        }

        await this.#repository.save(mailAccount);
        await this.#repository.saveHistory(mailAccount);
    }

    async setupChannelHubAccount(idGrupoActivo, mailAccount) {
        const restflowConfig = await this.#restflowCreateAccountChannelhub(idGrupoActivo);

        const accountChannelHubFlowId = restflowConfig
            ? restflowConfig.settings?.behaviors?.configurations?.application?.agente?.channel_hub
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

    async validateHost(host) {
        if (!(await this.#repository.isAllowedConnection(host))) {
            throw new CustomError(`Host '${host}' is not allowed.`, 400, null, MAIL_ACCOUNT_HOST_NOT_ALLOWED);
        }
    }

    /**
     *
     * @param {string} idGrupoActivo
     * @return {Promise<GlobalConfigurations|null>}
     */
    async #restflowCreateAccountChannelhub(idGrupoActivo) {
        if (!idGrupoActivo) {
            return null;
        }

        const group = await this.#groupsRepository.find(new ValueObjectUuid('id', idGrupoActivo));
        if (!group) {
            return null;
        }

        const config = await this.#globalConfigRepository.find(group.configuration_id);
        return config || null;
    }
}
