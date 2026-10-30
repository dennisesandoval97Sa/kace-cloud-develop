import { UserFinder } from '../../domain/UserFinder.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { ValueObjectTimestamp } from '../../../shared/domain/value-object/ValueObjectTimestamp.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { USER_ACTIVITY_STALENESS_MS } from '../../domain/userActivityStaleness.js';

export class UserIntegrationActivityUpdater {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;
    /** @type {UserFinder} is initialized in the constructor */
    #userFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#userFinder = new UserFinder(repository);
    }

    /**
     * Updates the last integration active timestamp for a user.
     *
     * @param {string} userId - The UUID of the user to update.
     * @param {string} timestamp - The ISO 8601 timestamp of the last integration activity.
     * @returns {Promise<void>}
     */
    async execute(userId, timestamp) {
        //NO-SONAR: Son validaciones de valor
        new ValueObjectUuid('userId', userId);
        new ValueObjectTimestamp('timestamp', timestamp);
        const user = await this.#userFinder.execute(userId);

        if (!user) {
            throw new ValidationFailError(`User with ID ${userId} does not exist.`, 'userId');
        }

        const current = user.last_integration_active_at?.value ?? null;
        const currentMs = current ? new Date(current).getTime() : 0;
        if (currentMs >= Date.now() - USER_ACTIVITY_STALENESS_MS) {
            return;
        }

        const originalValues = user.toJson();
        user.last_integration_active_at = timestamp;

        await this.#repository.updateLastIntegrationActiveAt(userId, timestamp);
        await this.#repository.saveHistory(user, originalValues);
    }
}
