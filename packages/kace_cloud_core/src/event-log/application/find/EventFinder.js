import { CustomError } from '../../../shared/index.js';
import { EventResponse, DomainEventFinder } from '../../index.js';

export class EventFinder {
    /** @type {DomainEventFinder} */
    #finder;

    /**
     * Creates an instance of `EventFinder`.
     *
     * @param {KnexEventRepository} repository - The repository used to access Event records.
     */
    constructor(repository) {
        this.#finder = new DomainEventFinder(repository);
    }

    /**
     * Executes the process of finding an Event by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Event to find.
     * @returns {Promise<EventResponse>} A promise that resolves to an EventResponse containing the found Event data.
     * @throws {CustomError} If the Event is not found or has been marked as deleted.
     */
    async execute(id) {
        const event = await this.#finder.execute(id);

        if (!event) {
            throw new CustomError('Event not found', 404);
        }

        return new EventResponse(event);
    }
}
