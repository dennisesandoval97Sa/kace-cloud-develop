import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { KnexBoardsRepository } from '../../src/boards/infrastructure/persistence/KnexBoardsRepository.js';
import BoardsMother from './domain/BoardsMother.js';

describe('Board bulk actions flags integration', () => {
    const repository = new KnexBoardsRepository(knexConfig);

    it('persists can_admin_bulk_actions and can_agent_bulk_actions on create', async () => {
        const board = await BoardsMother.create(repository, {
            can_admin_bulk_actions: true,
            can_agent_bulk_actions: false,
            havings: [],
        });

        const stored = await repository.find(board.id);

        expect(stored.can_admin_bulk_actions.value).toBe(true);
        expect(stored.can_agent_bulk_actions.value).toBe(false);
    });

    it('persists can_admin_bulk_actions and can_agent_bulk_actions on update', async () => {
        const board = await BoardsMother.create(repository, {
            can_admin_bulk_actions: true,
            can_agent_bulk_actions: true,
            havings: [],
        });

        board.update({
            can_admin_bulk_actions: false,
            can_agent_bulk_actions: false,
            updated_at: new Date().toISOString(),
            updated_by: board.created_by.value,
        });

        await repository.update(board);

        const stored = await repository.find(board.id);

        expect(stored.can_admin_bulk_actions.value).toBe(false);
        expect(stored.can_agent_bulk_actions.value).toBe(false);
    });
});
