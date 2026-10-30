import { CustomError } from '../../../shared/index.js';
import { EventLog, DomainEventFinder } from '../../index.js';

/**
 * Responsible for handling the creation of new Event records.
 */
export class EventCreator {
    /** @type {KnexEventRepository} */
    #repository;

    /** @type {DomainEventFinder} */
    #finder;

    /**
     * Creates an instance of `EventCreator`.
     *
     * @param {KnexEventRepository} repository - The repository used to save Event records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainEventFinder(repository);
    }

    /**
     * Executes the process of creating a new Event entity.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `Event` object.
     * @returns {Promise<void>} A promise that resolves when the `Event` object is successfully created.
     * @throws {CustomError} If an event with the same ID already exists.
     */
    async execute(dto) {
        const event = EventLog.create(dto);

        const existing = await this.#finder.execute(dto.id);
        if (existing) {
            throw new CustomError(`Event with id ${dto.id} already exists`, 400);
        }

        await this.#repository.save(event);
    }
}
