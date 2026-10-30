import { jest } from '@jest/globals';
import { BoardCreator } from '../../src/boards/application/create/BoardCreator.js';
import { ValidationFailError } from '../../src/shared/index.js';
import BoardsMother from './domain/BoardsMother.js';

/**
 * Unit tests for BoardCreator's two "already exists" guard branches (lines
 * 43 and 48): both were previously only exercised on the "does not exist yet"
 * side by the real-DB integration suites. The repository is a
 * constructor-injected collaborator (BoardCreator builds BoardFinder,
 * BoardNameFinder, GroupsExistenceValidator, UsersExistenceValidator and
 * BoardBulkViewColumnsValidator from it internally), so this is a pure
 * application-layer unit test with a fake double.
 */
describe('BoardCreator - duplicate guards', () => {
    const buildRepository = (overrides = {}) => ({
        tableName: 'boards',
        connection: {},
        find: jest.fn(async () => null),
        findByName: jest.fn(async () => null),
        save: jest.fn(async () => {}),
        saveHistory: jest.fn(async () => {}),
        ...overrides,
    });

    it('lanza ValidationFailError cuando ya existe un board con ese id', async () => {
        // Arrange
        const repository = buildRepository({ find: jest.fn(async () => ({ id: 'exists' })) });
        const creator = new BoardCreator(repository);
        const dto = BoardsMother.dto();

        // Act & Assert
        await expect(creator.execute(dto)).rejects.toBeInstanceOf(ValidationFailError);
        expect(repository.save).not.toHaveBeenCalled();
    });

    it('lanza ValidationFailError cuando ya existe un board con ese nombre', async () => {
        // Arrange
        const repository = buildRepository({ findByName: jest.fn(async () => ({ id: 'other' })) });
        const creator = new BoardCreator(repository);
        const dto = BoardsMother.dto();

        // Act & Assert
        await expect(creator.execute(dto)).rejects.toBeInstanceOf(ValidationFailError);
        expect(repository.save).not.toHaveBeenCalled();
    });
});
