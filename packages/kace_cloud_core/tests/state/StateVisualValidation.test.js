import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { State } from '../../src/state/index.js';
import { StateMother } from './domain/StateMother.js';

describe('State visual allowlist validation', () => {
    it('creates a state with allowlisted icon and color values', () => {
        const state = State.create(StateMother.dto());

        expect(state.icon_class.value).toBe(StateMother.dto().icon_class);
        expect(state.color.value).toBe(StateMother.dto().color);
    });

    it('rejects manipulated icon values on create', () => {
        expect(() => State.create(StateMother.dto({ icon_class: 'check' }))).toThrow(
            new InvalidArgumentError('icon class: Unsupported visual icon check')
        );
    });

    it('rejects manipulated color values on update', () => {
        const state = State.create(StateMother.dto());

        expect(() => state.update({ color: '#FFFFFF' })).toThrow(
            new InvalidArgumentError('color: Unsupported visual color #FFFFFF')
        );
    });

    it('allows clearing color and icon to null on update', () => {
        const state = State.create(StateMother.dto());

        expect(() => state.update({ color: null })).not.toThrow();
        expect(() => state.update({ icon_class: null })).not.toThrow();
        expect(state.color.value ?? null).toBeNull();
        expect(state.icon_class.value ?? null).toBeNull();
    });
});
