import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';

export class TransitionsFinder {
    /** @type {KnexTransitionsRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexTransitionsRepository} repository
     */

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for filter
     * @param {object} [options={}] options
     * @param {boolean} [options.skipCache=false] if true, bypass cache and read fresh
     * @returns {Promise<Transitions|null>}
     */
    async execute(id, options = {}) {
        return this.#repository.find(new ValueObjectUuid('id', id), options);
    }
}
