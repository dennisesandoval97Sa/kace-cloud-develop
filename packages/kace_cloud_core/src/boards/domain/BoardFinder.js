import { Board } from "@kace/core/src/boards/domain/Board";
import { ValueObjectUuid } from "@kace/core/src/shared";
import { KnexBoardsRepository } from "../infrastructure/persistence/KnexBoardsRepository";

export class BoardFinder {
    /** @type {KnexBoardsRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexBoardsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca un board por su ID.
     * @param {string} id
     * @returns {Promise<Board|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
}
