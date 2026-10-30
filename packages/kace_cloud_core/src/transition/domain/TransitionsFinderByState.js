import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';

export class TransitionsFinderByState {
    /** @type {KnexTransitionsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexTransitionsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds all transitions that use a specific state as source or target.
     *
     * @param {string} stateId - The state ID to search for.
     * @returns {Promise<Array>} Array of transitions using the state.
     */
    async execute(stateId) {
        const stateUuid = new ValueObjectUuid('stateId', stateId);
        return this.#repository.findByStateId(stateUuid);
    }
}
