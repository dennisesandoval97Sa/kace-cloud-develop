import { ValueObjectUuid } from '../../shared/index.js';
import { KnexInteractionJoinCases } from '../infrastructure/persistence/KnexInteractionJoinCases.js';

export class AssociateInteractionToCasoFinder {
    /**
     * @type {KnexInteractionJoinCases}
     * is initialized in the constructor
     */
    #repository;
    /**
     *
     * @param {KnexInteractionJoinCases} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for find Associate Interaction To Caso
     * @returns {Promise<Interaction|null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
