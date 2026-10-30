import { jest } from '@jest/globals';
import { BoardSearcher } from '../../src/boards/application/search/BoardSearcher.js';

/**
 * Unit test for BoardSearcher.execute's `count.count || count['count(*)']`
 * fallback (both branches). The repository is a constructor-injected
 * collaborator (also handed to the internally-built Counter), so this is a pure
 * application-layer unit test with a fake double.
 */
describe('BoardSearcher', () => {
    // execute() exige actor identificado; la llave maestra evita que actorScope entre en
    // juego y desvie el conteo hacia countBoards, que este doble no implementa.
    const adminActor = { userId: 'actor-id', isBoardAdmin: true };

    const buildRepository = (countResult, searchResult = []) => ({
        tableName: 'boards',
        search: jest.fn(async () => searchResult),
        count: jest.fn(async () => countResult),
    });

    it('usa count(*) cuando el contador no devuelve count', async () => {
        // Arrange
        const repository = buildRepository({ 'count(*)': '5' });
        const searcher = new BoardSearcher(repository);

        // Act
        const response = await searcher.execute({ filter: null, relationship: null, limit: 10, offset: 0 }, adminActor);

        // Assert
        expect(response.toJson().metadata.count).toBe('5');
    });

    it('usa count cuando el contador lo devuelve', async () => {
        // Arrange
        const repository = buildRepository({ count: '9' });
        const searcher = new BoardSearcher(repository);

        // Act
        const response = await searcher.execute({ filter: null, relationship: null, limit: 10, offset: 0 }, adminActor);

        // Assert
        expect(response.toJson().metadata.count).toBe('9');
    });
});
