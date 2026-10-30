import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { Board } from '../../src/boards/domain/Board.js';
import BoardsMother from './domain/BoardsMother.js';

describe('Board visual allowlist validation', () => {
    it('creates a board with an allowlisted icon', () => {
        const board = Board.create(BoardsMother.dto());

        expect(board.icon_class.value).toBe(BoardsMother.dto().icon_class);
    });

    it('rejects manipulated icon values on create', () => {
        expect(() => Board.create(BoardsMother.dto({ icon_class: 'check' }))).toThrow(
            new InvalidArgumentError('icon_class: Unsupported visual icon check')
        );
    });

    it('rejects manipulated icon values on update', () => {
        const board = Board.create(BoardsMother.dto());

        expect(() => board.update({ icon_class: 'warning' })).toThrow(
            new InvalidArgumentError('icon_class: Unsupported visual icon warning')
        );
    });

    it('allows clearing the icon to null on update', () => {
        const board = Board.create(BoardsMother.dto());

        expect(() => board.update({ icon_class: null })).not.toThrow();
        expect(board.icon_class.value ?? null).toBeNull();
    });
});
