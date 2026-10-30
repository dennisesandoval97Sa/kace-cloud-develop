import {
    ActionTriggers,
    CustomError,
    InvalidArgumentError,
    UniquenessValidator,
    ValidationFailError,
} from '../../../shared/index.js';
import { GroupFinderDomain, Groups } from '../../index';
import { UserGroupRelationship } from '../../../user-group-relationships/domain/UserGroupRelationship.js';
import { GROUP_CREATE_USERS_NOT_FOUND } from '@kace/error-codes';

export class GroupCreator {
    /** @type {KnexGroupsRepository} is initialized in the constructor*/
    #repository;
    /** @type {GroupFinderDomain} is initialized in the constructor*/
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor*/
    #uniquenessValidator;
    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;
    /** @type {KnexUserGroupRelationshipRepository | null} */
    #userGroupRepository;
    /** @type {IdsValidator | null} */
    #idsValidator;
    /** @type {GroupScheduleGuard | null} */
    #scheduleGuard;

    /**
     *
     * @param {KnexGroupsRepository} repository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param {KnexUserGroupRelationshipRepository} [userGroupRepository]
     * @param {IdsValidator} [idsValidator]
     * @param {GroupScheduleGuard} [scheduleGuard] rejects a `horario_id` that does not exist or was deleted
     */
    constructor(
        repository,
        actionExecutionService,
        userGroupRepository = null,
        idsValidator = null,
        scheduleGuard = null
    ) {
        this.#repository = repository;
        this.#finder = new GroupFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#actionExecutionService = actionExecutionService;
        this.#userGroupRepository = userGroupRepository;
        this.#idsValidator = idsValidator;
        this.#scheduleGuard = scheduleGuard;
    }

    /**
     *
     * @param {object} dto data for insert a new group
     * @returns {Promise<Any>}
     * @remarks The schedule check, group, history, and initial memberships are committed atomically. CREATE_GROUP
     * actions run after that commit because they may perform external I/O; atomic action delivery
     * requires a transactional outbox rather than holding the database transaction open.
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new Error('dto cannot be null or undefined');

        const userIds = this.#normalizeUserIds(dto.user_ids);
        const createsMemberships = Boolean(this.#userGroupRepository);
        if (createsMemberships) {
            if (!this.#idsValidator) {
                throw new Error('idsValidator is required when creating groups with user memberships');
            }
            try {
                if (userIds.length > 0) {
                    await this.#idsValidator.validateUserIds(userIds);
                }
            } catch (error) {
                if (error instanceof InvalidArgumentError) {
                    throw new ValidationFailError(
                        'One or more user_ids do not exist',
                        'user_ids',
                        [],
                        GROUP_CREATE_USERS_NOT_FOUND
                    );
                }
                throw error;
            }
        }

        const { user_ids: _userIds, ...groupDto } = dto;
        const creator = Groups.create(groupDto);
        const result = await this.#finder.execute(creator.id.value);
        if (result) {
            throw new CustomError(`Group with id ${creator.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('nombre', groupDto.nombre);

        const actorId = creator.created_by.value;
        const createdAt = new Date().toISOString();
        await this.#repository.withTransaction(async (trx) => {
            await this.#scheduleGuard?.ensureScheduleAvailable(creator.horario_id.value, trx);
            await this.#repository.save(creator, trx);
            await this.#repository.saveHistory(creator, null, trx);
            if (!createsMemberships) {
                return;
            }
            for (const usuario_id of userIds) {
                const membership = UserGroupRelationship.create({
                    usuario_id,
                    grupo_id: creator.id.value,
                });
                await this.#userGroupRepository.save(membership, trx);
                await this.#userGroupRepository.saveCreationHistory(membership, actorId, createdAt, trx);
            }
        });

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.CREATE_GROUP.value, creator);
        }

        return creator.id.value;
    }

    #normalizeUserIds(userIds) {
        if (!Array.isArray(userIds)) {
            return [];
        }
        return [...new Set(userIds.filter(Boolean))];
    }
}
