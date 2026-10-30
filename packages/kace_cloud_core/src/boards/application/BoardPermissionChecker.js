import { ValueObjectUuid } from '@kace/core/src/shared';

/**
 * Checks whether a user has permission for an action on a board, based on role and board configuration.
 */
export class BoardPermissionChecker {
    /** @type {Object} */
    #repository;

    /**
     * @param {Object} boardsRepository - Boards repository (e.g. KnexBoardsRepository)
     */
    constructor(boardsRepository) {
        this.#repository = boardsRepository;
    }

    /**
     * Checks that the user has the board permission for the given role and that the board configuration allows it.
     * @param {Object} user - User with method hasPermission(role, moduleId, action)
     * @param {string} boardId - Board UUID
     * @param {'can_view_record'|'can_create_record'|'can_edit_record'} configFlag - Board config flag to validate
     * @param {'BoardsReadRegister'|'BoardsCreateRegister'|'BoardsUpdateRegister'} permission - Permission name in the boards module
     * @param {'agente'|'administrador'} role - Role used to evaluate the permission
     * @returns {Promise<boolean>} true if the board exists, the flag is true and the user has the permission; false otherwise
     */
    async execute(user, boardId, configFlag, permission, role) {
        const board = await this.#repository.find(new ValueObjectUuid('id', boardId));
        if (!board) return false;
        const configAllowed = board[configFlag].value === true;
        const hasBoardPermission = user.hasPermission(role, 'boards', permission);
        return hasBoardPermission && configAllowed;
    }
}
