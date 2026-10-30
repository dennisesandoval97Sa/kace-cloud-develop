import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { DomainUserFinder, User } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ActionTriggers } from '../../../actions/index.js';
import { InvalidArgumentError, ValidationFailError } from '../../../shared/index.js';
import { UserGroupRelationship } from '../../../user-group-relationships/domain/UserGroupRelationship.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import {
    USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS,
    USER_CREATE_GROUPS_NOT_FOUND,
    USER_CREATE_GROUPS_REQUIRED,
} from '@kace/error-codes';

export class UserCreator {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainUserFinder} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;
    /** @type {KnexUserGroupRelationshipRepository | null} */
    #userGroupRepository;
    /** @type {IdsValidator | null} */
    #idsValidator;

    /**
     * @param {KnexUsersRepository} repository
     * @param {ActionExecutionDomainService} [actionExecutionService]
     * @param {KnexUserGroupRelationshipRepository} [userGroupRepository] - when set, product create requires group_ids and creates memberships atomically
     * @param {IdsValidator} [idsValidator]
     */
    constructor(repository, actionExecutionService, userGroupRepository = null, idsValidator = null) {
        this.#repository = repository;
        this.#finder = new DomainUserFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#actionExecutionService = actionExecutionService;
        this.#userGroupRepository = userGroupRepository;
        this.#idsValidator = idsValidator;
    }

    /**
     * Executes the process of creating a new user.
     * When membership dependencies are configured, requires at least one group_id and
     * persists the user and initial User-Group Memberships in one transaction.
     * @param {Object} dto - The data transfer object containing the properties for the User object.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        const groupIds = this.#normalizeGroupIds(dto.group_ids);
        const isProductCreate = Boolean(this.#userGroupRepository);

        if (isProductCreate) {
            if (groupIds.length === 0) {
                throw new ValidationFailError(
                    'group_ids must contain at least one group',
                    'group_ids',
                    [],
                    USER_CREATE_GROUPS_REQUIRED
                );
            }
            if (!this.#idsValidator) {
                throw new Error('idsValidator is required when creating users with group memberships');
            }
            try {
                await this.#idsValidator.validateGroupIds(groupIds);
            } catch (error) {
                if (error instanceof InvalidArgumentError) {
                    throw new ValidationFailError(
                        'One or more group_ids do not exist',
                        'group_ids',
                        [],
                        USER_CREATE_GROUPS_NOT_FOUND
                    );
                }
                throw error;
            }
            if (!dto.grupo_activo) {
                dto.grupo_activo = groupIds[0];
            }
            if (!groupIds.includes(dto.grupo_activo)) {
                throw new ValidationFailError(
                    'grupo_activo must be one of group_ids',
                    'grupo_activo',
                    [],
                    USER_CREATE_ACTIVE_GROUP_NOT_IN_MEMBERSHIPS
                );
            }
        }

        const { group_ids: _groupIds, ...userDto } = dto;
        const user = new User(userDto);

        const result = await this.#finder.execute(user.id.value);
        if (result) {
            throw new CustomError(`User with id ${user.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('login', dto.login);

        if (isProductCreate) {
            const actorId = user.created_by?.value ?? user.id.value;
            const createdAt = new Date().toISOString();
            try {
                await this.#repository.withTransaction(async (trx) => {
                    await this.#repository.save(user, trx);
                    await this.#repository.saveHistory(user, null, trx);
                    for (const grupo_id of groupIds) {
                        const membership = UserGroupRelationship.create({
                            usuario_id: user.id.value,
                            grupo_id,
                        });
                        await this.#userGroupRepository.save(membership, trx);
                        await this.#userGroupRepository.saveCreationHistory(membership, actorId, createdAt, trx);
                    }
                });
            } catch (error) {
                Helper.logError(error);
                throw error;
            }
        } else {
            await this.#repository.save(user);
            await this.#repository.saveHistory(user);
        }

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.CREATE_USER.value, user);
        }
    }

    #normalizeGroupIds(groupIds) {
        if (!Array.isArray(groupIds)) {
            return [];
        }
        return [...new Set(groupIds.filter(Boolean))];
    }
}
