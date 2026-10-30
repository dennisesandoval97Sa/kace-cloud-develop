import { ValidationFailError } from '@kace/core/src/shared/index.js';
import { BoardBulkActionsPolicy } from '../../domain/BoardBulkActionsPolicy.js';
import { BoardBulkViewColumnsValidator } from '../../domain/BoardBulkViewColumnsValidator.js';
import { Board } from '../../domain/Board.js';
import { BoardFinder } from '@kace/core/src/boards/domain/BoardFinder.js';
import { BoardNameFinder } from '@kace/core/src/boards/domain/BoardNameFinder.js';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import { GroupsExistenceValidator } from '../../domain/GroupsExistenceValidator';
import { UsersExistenceValidator } from '../../domain/UsersExistenceValidator';

export class BoardCreator {
    /** @type {KnexBoardsRepository} is initialized in the constructor */
    #repository;
    /** @type {BoardFinder} is initialized in the constructor */
    #finder;
    /** @type {BoardNameFinder} */
    #nameFinder;

    /**
     * @param {KnexBoardsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new BoardFinder(repository);
        this.#nameFinder = new BoardNameFinder(repository);
        this.groupsValidator = new GroupsExistenceValidator(repository);
        this.usersValidator = new UsersExistenceValidator(repository);
        this.bulkViewColumnsValidator = new BoardBulkViewColumnsValidator(repository);
    }

    /**
     * Crea un nuevo Board y lo guarda en el repositorio.
     * @param {Object} dto - Datos para la creación de la entidad.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        BoardBulkActionsPolicy.validate(dto);
        await this.bulkViewColumnsValidator.validate(dto);

        const board = Board.create(dto);

        const exists = await this.#finder.execute(board.id.value);
        if (exists) {
            throw new ValidationFailError(`Board with id ${board.id.value} already exists`, 'board');
        }

        const existsByName = await this.#nameFinder.validateUniqueName(board.name.value);
        if (existsByName) {
            throw new ValidationFailError(`Board with name '${board.name.value}' already exists`, 'name');
        }

        await this.groupsValidator.validate(dto.access_groups);
        await this.usersValidator.validate(dto.access_users);

        await this.#repository.save(board);
        await this.#repository.saveHistory(board);
    }
}
