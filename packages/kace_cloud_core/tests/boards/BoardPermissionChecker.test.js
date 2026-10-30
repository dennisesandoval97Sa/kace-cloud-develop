import { jest } from '@jest/globals';
import { BoardPermissionChecker } from '../../src/boards/application/BoardPermissionChecker.js';

describe('BoardPermissionChecker', () => {
    const buildUser = (hasPermission) => ({ hasPermission: jest.fn(() => hasPermission) });
    const buildRepository = (board) => ({ find: jest.fn(async () => board) });

    it('devuelve false cuando el board no existe', async () => {
        // Arrange
        const repository = buildRepository(null);
        const checker = new BoardPermissionChecker(repository);
        const user = buildUser(true);

        // Act
        const result = await checker.execute(
            user,
            '11111111-1111-4111-8111-111111111111',
            'can_view_record',
            'BoardsReadRegister',
            'agente'
        );

        // Assert
        expect(result).toBe(false);
        expect(user.hasPermission).not.toHaveBeenCalled();
    });

    it('devuelve true cuando el usuario tiene el permiso y el flag del board lo permite', async () => {
        // Arrange
        const board = { can_view_record: { value: true } };
        const repository = buildRepository(board);
        const checker = new BoardPermissionChecker(repository);
        const user = buildUser(true);

        // Act
        const result = await checker.execute(
            user,
            '11111111-1111-4111-8111-111111111111',
            'can_view_record',
            'BoardsReadRegister',
            'agente'
        );

        // Assert
        expect(result).toBe(true);
        expect(user.hasPermission).toHaveBeenCalledWith('agente', 'boards', 'BoardsReadRegister');
    });

    it('devuelve false cuando el usuario tiene el permiso pero el flag del board lo prohibe', async () => {
        // Arrange
        const board = { can_edit_record: { value: false } };
        const repository = buildRepository(board);
        const checker = new BoardPermissionChecker(repository);
        const user = buildUser(true);

        // Act
        const result = await checker.execute(
            user,
            '11111111-1111-4111-8111-111111111111',
            'can_edit_record',
            'BoardsUpdateRegister',
            'agente'
        );

        // Assert
        expect(result).toBe(false);
    });

    it('devuelve false cuando el flag del board lo permite pero el usuario no tiene el permiso', async () => {
        // Arrange
        const board = { can_create_record: { value: true } };
        const repository = buildRepository(board);
        const checker = new BoardPermissionChecker(repository);
        const user = buildUser(false);

        // Act
        const result = await checker.execute(
            user,
            '11111111-1111-4111-8111-111111111111',
            'can_create_record',
            'BoardsCreateRegister',
            'administrador'
        );

        // Assert
        expect(result).toBe(false);
    });
});
