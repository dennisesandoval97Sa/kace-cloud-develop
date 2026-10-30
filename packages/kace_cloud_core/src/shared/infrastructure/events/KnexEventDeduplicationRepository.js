import { Helper } from '../utils/Helper.js';
import { KnexRepository } from '../persistence/KnexRepository.js';

/**
 * PostgreSQL/SQLite implementation of EventDeduplicationRepository using Knex.
 * Stores processed event IDs in the `event_deduplication` table.
 */
export class KnexEventDeduplicationRepository extends KnexRepository {
    static TABLE_NAME = 'event_deduplication';

    /**
     * @param {import('knex').Knex.Config | import('knex').Knex} config - A Knex config object or active Knex instance
     */
    constructor(config) {
        if (!config) {
            throw new Error('KnexEventDeduplicationRepository: connection is required');
        }
        super(config, KnexEventDeduplicationRepository.TABLE_NAME);
    }

    /**
     * Checks whether an event with the given ID has already been processed.
     * @param {string} eventId
     * @returns {Promise<boolean>}
     */
    async exists(eventId) {
        try {
            const row = await this.table().where({ event_id: eventId }).first();
            return !!row;
        } catch (error) {
            Helper.logError('KnexEventDeduplicationRepository: Error checking event existence', {
                eventId,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Records that an event has been processed.
     * @param {string} eventId
     * @param {string} eventName
     * @param {string} aggregateId
     * @returns {Promise<void>}
     */
    async save(eventId, eventName, aggregateId) {
        try {
            await this.table().insert({
                event_id: eventId,
                event_name: eventName,
                aggregate_id: aggregateId,
                processed_at: new Date().toISOString(),
            });
        } catch (error) {
            // Ignore duplicate key errors (event already marked as processed)
            if (error.code === '23505' || error.message?.includes('UNIQUE constraint failed')) {
                Helper.logDebug('KnexEventDeduplicationRepository: Event already recorded (duplicate key)', {
                    eventId,
                });
                return;
            }
            Helper.logError('KnexEventDeduplicationRepository: Error saving event', {
                eventId,
                error: error.message,
            });
            throw error;
        }
    }
}
