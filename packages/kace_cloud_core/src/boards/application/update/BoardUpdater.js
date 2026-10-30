import { BoardBulkActionsPolicy } from '@kace/core/src/boards/domain/BoardBulkActionsPolicy.js';
import { BoardBulkViewColumnsValidator } from '@kace/core/src/boards/domain/BoardBulkViewColumnsValidator.js';
import { BoardFinder } from '@kace/core/src/boards/domain/BoardFinder';
import { BoardNameFinder } from '@kace/core/src/boards/domain/BoardNameFinder';
import { GroupsExistenceValidator } from '@kace/core/src/boards/domain/GroupsExistenceValidator';
import { UsersExistenceValidator } from '@kace/core/src/boards/domain/UsersExistenceValidator';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { ValidationFailError } from '@kace/core/src/shared';

export class BoardUpdater {
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
        this.bulkViewColumnsValidator = new BoardBulkViewColumnsValidator(repository);
        this.groupsValidator = new GroupsExistenceValidator(repository);
        this.usersValidator = new UsersExistenceValidator(repository);
    }

    /**
     * Actualiza un Board existente.
     * @param {object} dto - Datos para actualizar
     * @param {string} id - Identificador del registro a actualizar
     * @returns {Promise<Board>}
     */
    async execute(dto, id) {
        const board = await this.#finder.execute(id);
        if (!board) {
            throw new ValidationFailError('Board that you are trying to update does not exist', 'board');
        }

        if (!!dto.name && dto.name !== board.name.value) {
            const existsByName = await this.#nameFinder.validateUniqueName(dto.name);
            if (existsByName) {
                throw new ValidationFailError(`Board with name '${dto.name}' already exists`, 'name');
            }
        }

        if (dto.access_users !== undefined) {
            await this.usersValidator.validate(dto.access_users);
        }
        if (dto.access_groups !== undefined) {
            await this.groupsValidator.validate(dto.access_groups);
        }

        BoardBulkActionsPolicy.validateForUpdate(board, dto);
        await this.bulkViewColumnsValidator.validate({
            primary_entity: dto.primary_entity !== undefined ? dto.primary_entity : board.primary_entity.value,
            can_admin_bulk_actions:
                dto.can_admin_bulk_actions !== undefined
                    ? dto.can_admin_bulk_actions
                    : board.can_admin_bulk_actions.value,
            can_agent_bulk_actions:
                dto.can_agent_bulk_actions !== undefined
                    ? dto.can_agent_bulk_actions
                    : board.can_agent_bulk_actions.value,
        });

        const originalValues = board.toJson();

        board.update(dto);

        await this.#repository.update(board);
        await this.#repository.saveHistory(board, originalValues);
        board.flushChanges();

        return board;
    }
}
