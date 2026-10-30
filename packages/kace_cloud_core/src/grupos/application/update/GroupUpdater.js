import { CustomError, UniquenessValidator, ActionTriggers, StatusEnum } from '../../../shared/index.js';
import { GroupFinderDomain } from '../../index';
import { ExternalCodeGroupResolver } from '../../../actions-queue-executions/domain/services/ExternalCodeGroupResolver.js';

/**
 * Fields that determine how an external code resolves to an active group. Any real change
 * on one of them makes the cached `external code → group` entries stale.
 */
const RESOLVER_CACHE_FIELDS = ['status', 'codigo_externo', 'codigos_externos'];

export class GroupUpdater {
    /** @type {KnexGroupsRepository} is initialized in the constructor */
    #repository;
    /** @type {GroupFinderDomain} is initialized in the constructor */
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {ActionExecutionDomainService} is initialized in the constructor */
    #actionExecutionService;
    /** @type {GroupUsageGuard|undefined} is initialized in the constructor */
    #usageGuard;
    /** @type {GroupScheduleGuard|undefined} is initialized in the constructor */
    #scheduleGuard;

    /**
     *
     * @param {KnexGroupsRepository} repository
     * @param {ActionExecutionDomainService} actionExecutionService
     * @param {GroupUsageGuard} [usageGuard] optional guard that blocks deactivation when users have this group as `grupo_activo`
     * @param {GroupScheduleGuard} [scheduleGuard] rejects a new `horario_id` that does not exist or was deleted
     */
    constructor(repository, actionExecutionService, usageGuard, scheduleGuard) {
        this.#repository = repository;
        this.#finder = new GroupFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#actionExecutionService = actionExecutionService;
        this.#usageGuard = usageGuard;
        this.#scheduleGuard = scheduleGuard;
    }

    /**
     * Update group data by id
     * @param {object} updateDto data object for update
     * @param {string} id id for update
     */
    async execute(updateDto, id) {
        const group = await this.#finder.execute(id);

        if (group === null) {
            throw new CustomError(`The group you are trying update does not exist`, 404);
        }

        if (updateDto.nombre) {
            await this.#uniquenessValidator.validate('nombre', updateDto.nombre, id);
        }

        const previousStatus = group.status?.value;
        const statusChanged = updateDto.status !== undefined && Number(previousStatus) !== Number(updateDto.status);
        const isDeactivating =
            statusChanged &&
            Number(previousStatus) === StatusEnum.ACTIVE.value &&
            Number(updateDto.status) === StatusEnum.INACTIVE.value;

        if (isDeactivating && this.#usageGuard) {
            await this.#usageGuard.ensureNoActiveAssignments(id);
        }

        // Only a new schedule is checked: resending the current one must not block unrelated edits.
        const changesSchedule = updateDto.horario_id !== undefined && updateDto.horario_id !== group.horario_id.value;

        const affectsResolverCache = await this.#repository.withTransaction(async (trx) => {
            if (changesSchedule) {
                await this.#scheduleGuard?.ensureScheduleAvailable(updateDto.horario_id, trx);
            }

            const originalValues = group.toJson();
            group.update(updateDto);

            await this.#repository.update(group, trx);
            await this.#repository.saveHistory(group, originalValues, trx);

            // `update()` only touches a setter when the value really differs (comparing JSON for
            // objects), so `changedAttributes` already tells us whether the resolution inputs moved.
            return RESOLVER_CACHE_FIELDS.some((field) => field in group.changedAttributes);
        });

        // External-code → active-group resolutions are cached for 5 minutes; a status flip or an
        // external-code reassignment must take effect immediately, in both directions.
        if (affectsResolverCache) {
            ExternalCodeGroupResolver.clearCache();
        }

        group.flushChanges();

        if (this.#actionExecutionService) {
            await this.#actionExecutionService.execute(ActionTriggers.UPDATE_GROUP.value, group);
        }
    }
}
