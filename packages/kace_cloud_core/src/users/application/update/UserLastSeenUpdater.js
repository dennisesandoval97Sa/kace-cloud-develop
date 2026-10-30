import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { USER_ACTIVITY_STALENESS_MS } from '../../domain/userActivityStaleness.js';

export class UserLastSeenUpdater {
    /** @type {KnexUsersRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Updates the last seen timestamp for a user session, but only if it is stale.
     *
     * The redundant existence SELECT was removed: the session controller already validates
     * the user and the token subject before calling this use case. The repository performs a
     * conditional UPDATE that writes nothing when `last_seen_at` is newer than the staleness
     * window (see SARA load test 2026-06-18, P1b).
     *
     * @param {string} userId - The UUID of the user.
     * @param {string} updatedBy - The UUID of the user performing the update.
     * @returns {Promise<void>}
     */
    async execute(userId, updatedBy) {
        new ValueObjectUuid('userId', userId);
        new ValueObjectUuid('updatedBy', updatedBy);

        const now = new Date();
        const nowIso = now.toISOString();
        const threshold = new Date(now.getTime() - USER_ACTIVITY_STALENESS_MS).toISOString();

        await this.#repository.updateLastSeenAt(userId, nowIso, updatedBy, threshold);
    }
}
