import { GroupFinderDomain } from '../../grupos';
import { CustomError, Helper } from '../../shared';
import { GlobalConfigFinder } from './GlobalConfigFinder';

export class GroupConfigService {
    /** @type {GroupFinderDomain} is initialized in the constructor */
    #groupFinder;
    /** @type {GlobalConfigFinder} is initialized in the constructor */
    #configFinder;

    /**
     * @param {KnexGroupsRepository} groupsRepository - Repository for group data
     * @param {KnexGlobalConfigurationRepository} configRepository - Repository for configuration data
     */
    constructor(groupsRepository, globalConfigurationRepository) {
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new GlobalConfigFinder(globalConfigurationRepository);
    }

    /**
     * Retrieves the global configuration for a user based on their active group.
     * @param {User} user - The authenticated user instance
     * @returns {Promise<import('./GlobalConfigurations').GlobalConfigurations>} The group's global configuration
     * @throws {CustomError} If validation fails
     */
    async execute(user) {
        this.#validateUser(user);
        const group = await this.#getUserActiveGroup(user);
        return this.#getGroupConfiguration(group);
    }

    /**
     * Validates that the user is provided and has an active group assigned.
     * @param {User} user - The user to validate
     * @throws {CustomError} If validation fails
     */
    #validateUser(user) {
        if (!user) {
            Helper.logError('GroupConfigService: User not provided');
            throw new CustomError('User must be provided', 400);
        }

        if (!user.grupo_activo?.value) {
            Helper.logInfo(`GroupConfigService: User ${user.id?.value} has no active group`);
            throw new CustomError('User has no active group assigned', 400);
        }
    }

    /**
     * Retrieves the active group for the given user.
     * @param {User} user - The user whose active group should be retrieved
     * @returns {Promise<Group>} The active group of the user
     * @throws {CustomError} If the group cannot be found or retrieved
     */
    async #getUserActiveGroup(user) {
        const groupId = user.grupo_activo.value;
        const group = await this.#groupFinder.execute(groupId);

        if (!group) {
            Helper.logInfo(`GroupConfigService: Group ${groupId} not found`);
            throw new CustomError('Active group not found', 404);
        }

        return group;
    }

    /**
     * Retrieves the configuration associated with a given group.
     * @param {Group} group - The group whose configuration should be retrieved
     * @returns {Promise<GlobalConfiguration>} The group's configuration
     * @throws {CustomError} If the configuration cannot be found or retrieved
     */
    async #getGroupConfiguration(group) {
        if (!group.configuration_id?.value) {
            Helper.logInfo(`GroupConfigService: Group ${group.id?.value} has no config`);
            throw new CustomError('Group has no configuration assigned', 400);
        }

        const configId = group.configuration_id.value;
        const config = await this.#configFinder.execute(configId);

        if (!config) {
            Helper.logInfo(`GroupConfigService: Config ${configId} not found`);
            throw new CustomError('Group configuration not found', 404);
        }

        return config;
    }
}
