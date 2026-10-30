import { BoardFinder } from '@kace/core/src/boards/domain/BoardFinder';
import { BoardNameFinder } from '@kace/core/src/boards/domain/BoardNameFinder';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { ValidationFailError } from '@kace/core/src/shared/index.js';

export class BoardDeleter {
    /** @type {KnexBoardsRepository} is initialized in the constructor */
    #repository;
    /** @type {BoardFinder} is initialized in the constructor */
    #finder;
    /** @type {BoardNameFinder} */


    /**
     * @param {KnexBoardsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new BoardFinder(repository);  
    }

    /**
     * Elimina (soft delete) un Board actualizando deleted_at y deleted_by.
     * @param {string|object} id - Identificador de la entidad
     * @param {Object} dto - Debe contener deleted_at y deleted_by
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const board = await this.#finder.execute(id);
        if (!board) {
            throw new ValidationFailError(`Board with id ${id} does not exist`);
        }

        const originalValues = board.toJson();

        board.delete(dto);
        await this.#repository.delete(board);    
        await this.#repository.saveHistory(board, originalValues);
  
        board.flushChanges();
    }
}
