import { Board } from '@kace/core/src/boards/domain/Board';
import { ValueObjectBoardName } from '@kace/core/src/boards/domain/ValueObjectBoardName';

export class BoardNameFinder {
    /** @type {KnexBoardsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexBoardsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * search for an Board by name.
     * @param {ValueObjectBoardName} name
     * @returns {Promise<Board|null>}
     */
    async validateUniqueName(name) {
        return this.#repository.findByName(new ValueObjectBoardName(name));
    }
}
