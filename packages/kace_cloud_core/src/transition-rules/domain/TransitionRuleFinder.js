import { ValueObjectUuid } from '../../shared/index.js';

export class TransitionRuleFinder {
    /**
     * @type {KnexTransitionRuleRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexTransitionRuleRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a TransitionRule by its ID.
     * @param {string} id
     * @returns {Promise<TransitionRule | null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
