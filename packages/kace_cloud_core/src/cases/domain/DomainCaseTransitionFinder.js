import { ValueObjectUuid } from '../../shared';

export class DomainCaseTransitionFinder {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
     */

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id) {
        return this.#repository.findTransitionsByCaseId(new ValueObjectUuid('id', id));
    }
}
