import { TransitionsFinderDomain } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';

export class TransitionUpdater {
    /** @type {KnexTransitionsRepository} is initialized in the constructor */
    #repository;

    /** @type {TransitionsFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexTransitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new TransitionsFinderDomain(repository);
    }

    /**
     *
     * @param {object} dto data object with properties to update
     * @param {string} id identificator for transition to update
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const transition = await this.#finder.execute(id);
        if (transition === null) {
            throw new CustomError(`The transition you are trying update does not exist`, 404);
        }

        const originalValues = transition.toJson();
        transition.update(dto);

        await this.#repository.update(transition);
        await this.#repository.saveHistory(transition, originalValues);
        transition.flushChanges();
    }
}
