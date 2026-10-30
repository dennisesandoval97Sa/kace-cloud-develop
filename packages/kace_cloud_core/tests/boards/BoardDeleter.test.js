import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { BoardDeleter } from '../../src/boards/application/delete/BoardDeleter.js';
import { Board } from '../../src/boards/domain/Board.js';
import { ValidationFailError } from '../../src/shared/index.js';

/**
 * Unit tests for BoardDeleter. The repository is a constructor-injected
 * collaborator (BoardDeleter builds its own internal BoardFinder from it), so
 * this is a pure application-layer unit test with a fake repository double - the
 * `Board` itself is a real domain entity (via `Board.create`) so `.delete()`/
 * `.flushChanges()`/`.toJson()` run their real AggregateRoot logic.
 */
describe('BoardDeleter', () => {
    const buildBoard = () =>
        Board.create({
            id: uuidv4(),
            name: 'test board',
            description: 'desc',
            primary_entity: 'cases',
            icon_class: 'BellOff',
            onescript_form_id: uuidv4(),
            created_at: new Date('2026-01-01T00:00:00.000Z'),
            created_by: uuidv4(),
            updated_at: new Date('2026-01-02T00:00:00.000Z'),
            updated_by: uuidv4(),
            criteria: { items: [] },
        });

    it('lanza ValidationFailError cuando el board no existe', async () => {
        // Arrange
        const repository = {
            find: jest.fn(async () => null),
            delete: jest.fn(),
            saveHistory: jest.fn(),
        };
        const deleter = new BoardDeleter(repository);

        // Act & Assert
        await expect(
            deleter.execute(uuidv4(), { deleted_at: new Date(), deleted_by: uuidv4() })
        ).rejects.toBeInstanceOf(ValidationFailError);
        expect(repository.delete).not.toHaveBeenCalled();
        expect(repository.saveHistory).not.toHaveBeenCalled();
    });

    it('marca el board como eliminado y guarda el historial cuando existe', async () => {
        // Arrange
        const board = buildBoard();
        const repository = {
            find: jest.fn(async () => board),
            delete: jest.fn(async () => {}),
            saveHistory: jest.fn(async () => {}),
        };
        const deleter = new BoardDeleter(repository);
        const deletedBy = uuidv4();
        const deletedAt = new Date('2026-05-01T00:00:00.000Z');
        // Snapshot PREVIO al borrado: es lo que BoardDeleter debe pasar como `originalValues`
        // (lo captura antes de `board.delete(dto)`). Se toma aqui, antes de execute().
        const expectedOriginal = board.toJson();
        expect(expectedOriginal).toMatchObject({
            id: board.id.value,
            name: 'test board',
            description: 'desc',
            primary_entity: 'cases',
        });

        // Act
        await deleter.execute(board.id.value, { deleted_at: deletedAt, deleted_by: deletedBy });

        // Assert
        expect(board.deleted_at.value).toBe(deletedAt.toISOString());
        expect(board.deleted_by.value).toBe(deletedBy);
        expect(repository.delete).toHaveBeenCalledWith(board);
        // El historial debe recibir el snapshot ANTERIOR al soft-delete, no un objeto
        // cualquiera ni los valores posteriores. `expect.any(Object)` aceptaba ambas cosas.
        expect(repository.saveHistory).toHaveBeenCalledWith(board, expectedOriginal);

        // El snapshot guardado debe ser un objeto plano con los valores reales del board.
        const [, savedOriginal] = repository.saveHistory.mock.calls[0];
        expect(savedOriginal.id).toBe(board.id.value);
        expect(savedOriginal.name).toBe('test board');
        expect(savedOriginal.primary_entity).toBe('cases');

        // NOTA (limitacion real de produccion, no del test): AggregateRoot.toJson() solo
        // recorre `Object.getOwnPropertyNames(Object.getPrototypeOf(this))`, es decir el
        // prototipo INMEDIATO (Board.prototype). Los getters `deleted_at`/`deleted_by` viven
        // en AggregateRoot.prototype, asi que NUNCA entran en el snapshot. Consecuencia: el
        // historial de un soft-delete no registra deleted_at/deleted_by, y `toJson()` antes y
        // despues de `board.delete(dto)` es identico -> capturar `originalValues` DESPUES del
        // cambio es indistinguible desde la API publica de BoardDeleter. Lo dejamos
        // documentado aqui; el assert de arriba si mata cualquier `originalValues` inventado.
        expect(board.toJson()).toEqual(expectedOriginal);
        expect(board.deleted_at.value).toBe(deletedAt.toISOString());
    });
});
