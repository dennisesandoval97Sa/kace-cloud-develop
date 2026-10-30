import { v4 as uuidv4 } from 'uuid';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import BoardsMother from './domain/BoardsMother.js';
import { knexConfig } from '../knexfile.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('searchAvailableBoards - orden configurable por display_order', () => {
    const repository = new KnexBoardsRepository(knexConfig);

    const groupId = uuidv4();
    const userId = uuidv4();

    /**
     * @param {string} name
     * @param {number|null} display_order
     * @param {string} created_at
     */
    const createBoard = (name, display_order, created_at) =>
        BoardsMother.createWithSpecificData(repository, {
            ...BoardsMother.dtoAuxiliary({ filters: { items: [] }, columns: [] }),
            id: uuidv4(),
            name,
            display_order,
            created_at,
            created_by: userId,
            access_groups: [groupId],
        });

    beforeEach(async () => {
        await ensureParentRow(repository.connection, 'usuarios', userId);
        await ensureParentRow(repository.connection, 'grupos', groupId);
    });

    it('ordena por display_order ascendente, ignorando la fecha de creacion', async () => {
        await createBoard('tablero-c', 3, '2026-01-03T00:00:00.000Z');
        await createBoard('tablero-a', 1, '2026-01-01T00:00:00.000Z');
        await createBoard('tablero-b', 2, '2026-01-02T00:00:00.000Z');

        const boards = await repository.searchAvailableBoards({ userId, groupId });

        expect(boards.map((board) => board.name.value)).toEqual(['tablero-a', 'tablero-b', 'tablero-c']);
    });

    it('coloca al final los tableros sin display_order asignado', async () => {
        await createBoard('sin-orden', null, '2026-02-01T00:00:00.000Z');
        await createBoard('con-orden', 10, '2026-01-01T00:00:00.000Z');

        const boards = await repository.searchAvailableBoards({ userId, groupId });

        expect(boards.map((board) => board.name.value)).toEqual(['con-orden', 'sin-orden']);
    });

    it('desempata por created_at desc cuando comparten display_order', async () => {
        await createBoard('empate-antiguo', 5, '2026-01-01T00:00:00.000Z');
        await createBoard('empate-reciente', 5, '2026-03-01T00:00:00.000Z');

        const boards = await repository.searchAvailableBoards({ userId, groupId });

        expect(boards.map((board) => board.name.value)).toEqual(['empate-reciente', 'empate-antiguo']);
    });

    it('persiste y devuelve display_order en el agregado', async () => {
        await createBoard('persistido', 7, '2026-01-01T00:00:00.000Z');

        const [board] = await repository.searchAvailableBoards({ userId, groupId });

        expect(board.display_order.value).toBe(7);
    });
});
