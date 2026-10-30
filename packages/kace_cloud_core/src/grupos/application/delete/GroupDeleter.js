import { CustomError } from '../../../shared/index.js';
import { GroupFinderDomain } from '../../index';
import { ActionTriggers } from '../../../actions/index.js';

export class GroupDeleter {
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #repository;

    /** @type {GroupFinderDomain} is initialized in the constructor */
    #finder;

    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;

    /** @type {GroupUsageGuard|undefined} is initialized in the constructor */
    #usageGuard;

    /** @type {GroupRelationsCleaner|undefined} is initialized in the constructor */
    #relationsCleaner;

    /**
     *
     * @param {KnexGroupsRepository} repository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param {GroupUsageGuard} [usageGuard] optional guard that blocks deletion when users have this group as `grupo_activo`
     * @param {GroupRelationsCleaner} [relationsCleaner] optional cleaner that wipes rel_usuarios_grupos for the group
     */
    constructor(repository, actionExecutionService, usageGuard, relationsCleaner) {
        this.#repository = repository;
        this.#finder = new GroupFinderDomain(repository);
        this.#actionExecutionService = actionExecutionService;
        this.#usageGuard = usageGuard;
        this.#relationsCleaner = relationsCleaner;
    }

    /**
     *
     * @param {string} id id group for delete
     * @param {object} deleteDto object with data for delete the group, example {deletedAt: new Date(), deletedBy: 'user_id'}
     * @returns {Promise<Any>}
     */
    async execute(id, deleteDto) {
        const group = await this.#finder.execute(id);

        if (group === null) {
            throw new CustomError(`The global config you are trying delete does not exist`, 404);
        }

        if (this.#usageGuard) {
            await this.#usageGuard.ensureNoActiveAssignments(id);
        }

        group.delete(deleteDto);

        if (this.#relationsCleaner) {
            await this.#repository.connection.transaction(async (trx) => {
                await this.#relationsCleaner.execute(id, {
                    actorId: deleteDto.deleted_by,
                    reason: 'group_deleted',
                    trx,
                });
                await this.#repository.delete(group, trx);
            });
        } else {
            await this.#repository.delete(group);
        }

        group.flushChanges();

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.DELETE_GROUP.value, group);
        }
    }
}
