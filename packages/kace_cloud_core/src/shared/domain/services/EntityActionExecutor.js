import { UserFinder } from '../../../users/domain/UserFinder.js';
import { SendEmail } from '../../../actions/domain/types/SendEmail.js';
import { CallWsService } from '../../../actions/domain/types/CallWsService.js';
import { Action, ActionTypes } from '../../../actions/index.js';
import { Helper } from '../../infrastructure/utils/Helper.js';
import { KnexTemplateAttachmentRepository } from '../../../template-attachments/index.js';

/**
 * Generic action executor for entities (users, groups, etc.)
 * This executor only handles action types applicable to non-case entities.
 * It does NOT include case-specific dependencies or logic.
 */
export class EntityActionExecutor {
    /** @type {KnexUsersRepository} */
    #userRepository;
    /** @type {KnexGroupsRepository} */
    #groupRepository;
    /** @type {KnexClientRepository} */
    #clientRepository;
    /** @type {KnexTemplatesRepository} */
    #templatesRepository;
    /** @type {KnexMailAccountRepository} */
    #mailAccountRepository;
    /** @type {KnexWSRestFlowRepository} */
    #wsRestFlowRepository;
    /** @type {KnexWSRestWorkflowStepRepository} */
    #wsRestWorkflowStepRepository;
    /** @type {KnexSecretsVaultRepository} */
    #secretRepository;
    /** @type {KnexAllowedConnectionsRepository} */
    #allowedConnectionRepository;
    /** @type {UserFinder} */
    #userFinder;

    /**
     * @param {Object} dependencies - Dependencies object
     * @param {KnexUsersRepository} dependencies.userRepository
     * @param {KnexGroupsRepository} dependencies.groupRepository
     * @param {KnexClientRepository} dependencies.clientRepository
     * @param {KnexTemplatesRepository} dependencies.templatesRepository
     * @param {KnexMailAccountRepository} dependencies.mailAccountRepository
     * @param {KnexWSRestFlowRepository} dependencies.wsRestFlowRepository
     * @param {KnexWSRestWorkflowStepRepository} dependencies.wsRestWorkflowStepRepository
     * @param {KnexSecretsVaultRepository} dependencies.secretRepository
     * @param {KnexAllowedConnectionsRepository} dependencies.allowedConnectionRepository
     */
    constructor({
        userRepository,
        groupRepository,
        clientRepository,
        templatesRepository,
        mailAccountRepository,
        wsRestFlowRepository,
        wsRestWorkflowStepRepository,
        secretRepository,
        allowedConnectionRepository,
    }) {
        this.#userRepository = userRepository;
        this.#groupRepository = groupRepository;
        this.#clientRepository = clientRepository;
        this.#templatesRepository = templatesRepository;
        this.#mailAccountRepository = mailAccountRepository;
        this.#wsRestFlowRepository = wsRestFlowRepository;
        this.#wsRestWorkflowStepRepository = wsRestWorkflowStepRepository;
        this.#secretRepository = secretRepository;
        this.#allowedConnectionRepository = allowedConnectionRepository;

        this.#userFinder = new UserFinder(userRepository);
    }

    /**
     * Execute an action for a given entity
     *
     * @param {Action} action - The action to execute
     * @param {Aggregate} entity - The entity (User, Group, etc.)
     * @param {Object} content - Additional content for the action
     * @param {string} trigger - The trigger that initiated this action
     * @returns {Promise<boolean>} True if execution was successful, false otherwise
     */
    async execute(action, entity, content = {}, trigger = null) {
        try {
            let entityModel;
            if (action.entity.value === 'user') {
                entityModel = await this.#userFinder.execute(entity.id.value);
            } else if (action.entity.value === 'group') {
                entityModel = await this.#groupRepository.find(entity.id);
            } else {
                Helper.logDebug('EntityActionExecutor: Unsupported entity type:', action.entity.value);
                return false;
            }

            if (!entityModel) {
                Helper.logDebug(
                    `EntityActionExecutor: entityModel not found. ${action.entity.value}Id:`,
                    entity.id.value
                );
                return false;
            }

            const currentUserId = entity.updated_by?.value || entity.created_by?.value;
            if (!currentUserId) {
                Helper.logDebug('EntityActionExecutor: No current user found in entity');
                return false;
            }

            const currentUser = await this.#userFinder.execute(currentUserId);
            if (!currentUser) {
                Helper.logDebug('EntityActionExecutor: currentUser not found. currentUserId:', currentUserId);
                return false;
            }

            if (!(action instanceof Action) || !action.hasPermission(currentUser)) {
                Helper.logDebug('EntityActionExecutor: action permission denied or invalid action instance');
                return false;
            }

            const actionType = action.action_type.value;
            Helper.logDebug('EntityActionExecutor: actionType:', actionType);

            let actionHandler = null;

            if (actionType === ActionTypes.ENVIO_CORREO.value) {
                // Positions 9-16 pass undefined to opt into SendEmail's own constructor
                // defaults (case attachments don't apply outside Case context anyway);
                // only position 17 (templateAttachmentRepository) is wired explicitly, so
                // template-level "Includes Attachments" files also attach for user/group-
                // triggered emails. See ActionExecutor.js for the full positional layout.
                actionHandler = new SendEmail(
                    this.#templatesRepository,
                    this.#mailAccountRepository,
                    this.#clientRepository,
                    this.#userRepository,
                    null,
                    null,
                    null,
                    this.#secretRepository,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    new KnexTemplateAttachmentRepository(this.#templatesRepository.connection)
                );
            }

            if (actionType === ActionTypes.CONSUMO_REST_FLOW.value) {
                Helper.logDebug('EntityActionExecutor: Executing REST flow with content:', content);

                let entityRepository;
                if (action.entity.value === 'user') {
                    entityRepository = this.#userRepository;
                } else if (action.entity.value === 'group') {
                    entityRepository = this.#groupRepository;
                } else {
                    Helper.logError(
                        'EntityActionExecutor: Unsupported entity type for REST flow:',
                        action.entity.value
                    );
                    return false;
                }

                actionHandler = new CallWsService(
                    entityRepository,
                    this.#wsRestFlowRepository,
                    this.#wsRestWorkflowStepRepository,
                    this.#secretRepository,
                    this.#allowedConnectionRepository,
                    currentUser,
                    content
                );
            }

            if (!actionHandler) {
                Helper.logInfo(`EntityActionExecutor: No handler found for action type: ${actionType}`);
                return false;
            }

            Helper.logDebug('EntityActionExecutor: Executing action handler');
            const result = await actionHandler.execute(entityModel, action, trigger);
            return result;
        } catch (error) {
            Helper.logError('EntityActionExecutor error:', error);
            return false;
        }
    }
}
