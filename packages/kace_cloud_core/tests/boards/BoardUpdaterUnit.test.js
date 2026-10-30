import { jest } from '@jest/globals';
import { BoardUpdater } from '../../src/boards/application/update/BoardUpdater.js';
import { Board } from '../../src/boards/domain/Board.js';
import { ValidationFailError } from '../../src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';
import BoardsMother from './domain/BoardsMother.js';

/**
 * Unit tests for BoardUpdater's guard branches and the dto/board merge
 * ternaries it feeds into BoardBulkViewColumnsValidator (lines 47, 49, 53).
 * The repository is a constructor-injected collaborator (BoardUpdater builds
 * BoardFinder, BoardNameFinder and BoardBulkViewColumnsValidator from it
 * internally), so this is a pure application-layer unit test with a fake
 * double; `Board` is the real domain entity.
 */
describe('BoardUpdater', () => {
    const buildBoard = (overrides = {}) => Board.create(BoardsMother.dto(overrides));

    const buildRepository = (overrides = {}) => ({
        tableName: 'boards',
        connection: {},
        find: jest.fn(async () => null),
        findByName: jest.fn(async () => null),
        update: jest.fn(async () => {}),
        saveHistory: jest.fn(async () => {}),
        findExistingIds: jest.fn(async (ids) => ids),
        ...overrides,
    });

    it('lanza ValidationFailError cuando el board no existe', async () => {
        // Arrange
        const repository = buildRepository();
        const updater = new BoardUpdater(repository);

        // Act & Assert
        await expect(updater.execute({ name: 'nuevo nombre' }, uuidv4())).rejects.toBeInstanceOf(ValidationFailError);
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('lanza ValidationFailError cuando el nuevo nombre ya existe en otro board', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({
            find: jest.fn(async () => board),
            findByName: jest.fn(async () => ({ id: 'otro-board' })),
        });
        const updater = new BoardUpdater(repository);

        // Act & Assert
        await expect(updater.execute({ name: 'nombre duplicado' }, board.id.value)).rejects.toBeInstanceOf(
            ValidationFailError
        );
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('no valida unicidad de nombre cuando el nombre no cambia', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({ find: jest.fn(async () => board) });
        const updater = new BoardUpdater(repository);

        // Act
        await updater.execute({ name: board.name.value }, board.id.value);

        // Assert
        expect(repository.findByName).not.toHaveBeenCalled();
        expect(repository.update).toHaveBeenCalledWith(board);
    });

    it('usa los valores del dto (no los del board) cuando el dto trae primary_entity/can_admin_bulk_actions/can_agent_bulk_actions', async () => {
        // Arrange
        const board = buildBoard({
            primary_entity: 'clients',
            can_admin_bulk_actions: false,
            can_agent_bulk_actions: false,
        });
        const repository = buildRepository({ find: jest.fn(async () => board) });
        const updater = new BoardUpdater(repository);
        // Snapshot PREVIO a la actualizacion: es lo que BoardUpdater debe pasar como
        // `originalValues` (lo captura antes de `board.update(dto)`).
        const expectedOriginal = board.toJson();
        expect(expectedOriginal.primary_entity).toBe('clients');
        expect(expectedOriginal.can_admin_bulk_actions).toBe(false);

        // Act: pisa las 3 claves con valores compatibles entre si (cases + sin group_by/having),
        // y ademas cambia el nombre (sin duplicado: findByName devuelve null) para cubrir el
        // camino "nombre cambiado, disponible" (existsByName falsy) de la linea 40.
        const updated = await updater.execute(
            {
                name: 'nombre nuevo disponible',
                primary_entity: 'cases',
                columns: [],
                havings: [],
                can_admin_bulk_actions: true,
                can_agent_bulk_actions: false,
            },
            board.id.value
        );

        // Assert
        expect(updated.name.value).toBe('nombre nuevo disponible');
        expect(updated.primary_entity.value).toBe('cases');
        expect(updated.can_admin_bulk_actions.value).toBe(true);
        expect(repository.findByName).toHaveBeenCalled();
        expect(repository.update).toHaveBeenCalledWith(board);
        // El historial debe recibir el snapshot ANTERIOR a la actualizacion, no un objeto
        // cualquiera ni los valores posteriores. `expect.any(Object)` aceptaba ambas cosas.
        expect(repository.saveHistory).toHaveBeenCalledWith(board, expectedOriginal);

        // Y el snapshot guardado debe diferir del estado actual justo en lo que cambio.
        const [, savedOriginal] = repository.saveHistory.mock.calls[0];
        expect(savedOriginal.name).not.toBe('nombre nuevo disponible');
        expect(savedOriginal.primary_entity).toBe('clients');
        expect(savedOriginal.can_admin_bulk_actions).toBe(false);
        expect(board.toJson().primary_entity).toBe('cases');
        expect(board.toJson().can_admin_bulk_actions).toBe(true);
    });

    it('lanza ValidationFailError cuando access_users incluye un usuario inexistente o eliminado', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({
            find: jest.fn(async () => board),
            // Simula que el usuario "user-eliminado" no existe entre los activos (soft-deleted o borrado).
            findExistingIds: jest.fn(async (ids) => ids.filter((id) => id !== 'user-eliminado')),
        });
        const updater = new BoardUpdater(repository);

        // Act & Assert
        await expect(updater.execute({ access_users: ['user-eliminado'] }, board.id.value)).rejects.toBeInstanceOf(
            ValidationFailError
        );
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('lanza ValidationFailError cuando access_groups incluye un grupo inexistente o eliminado', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({
            find: jest.fn(async () => board),
            findExistingIds: jest.fn(async (ids) => ids.filter((id) => id !== 'grupo-eliminado')),
        });
        const updater = new BoardUpdater(repository);

        // Act & Assert
        await expect(updater.execute({ access_groups: ['grupo-eliminado'] }, board.id.value)).rejects.toBeInstanceOf(
            ValidationFailError
        );
        expect(repository.update).not.toHaveBeenCalled();
    });

    it('actualiza el board cuando access_users y access_groups existen', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({ find: jest.fn(async () => board) });
        const updater = new BoardUpdater(repository);

        // Act
        await updater.execute({ access_users: ['user-1'], access_groups: ['group-1'] }, board.id.value);

        // Assert
        expect(repository.findExistingIds).toHaveBeenCalledWith(['user-1'], 'usuarios');
        expect(repository.findExistingIds).toHaveBeenCalledWith(['group-1'], 'grupos');
        expect(repository.update).toHaveBeenCalledWith(board);
    });

    it('no valida access_users/access_groups cuando el dto no los incluye', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({ find: jest.fn(async () => board) });
        const updater = new BoardUpdater(repository);

        // Act
        await updater.execute({ name: board.name.value }, board.id.value);

        // Assert
        expect(repository.findExistingIds).not.toHaveBeenCalled();
    });

    it('acepta arrays vacios explicitos (limpiar accesos) sin consultar existencia y actualiza', async () => {
        // Arrange
        const board = buildBoard();
        const repository = buildRepository({ find: jest.fn(async () => board) });
        const updater = new BoardUpdater(repository);

        // Act
        await updater.execute({ access_users: [], access_groups: [] }, board.id.value);

        // Assert: pasa la guarda !== undefined, el validador retorna temprano y se persiste el vaciado
        expect(repository.findExistingIds).not.toHaveBeenCalled();
        expect(repository.update).toHaveBeenCalledWith(board);
        expect(board.access_users.value).toEqual([]);
        expect(board.access_groups.value).toEqual([]);
    });
});
