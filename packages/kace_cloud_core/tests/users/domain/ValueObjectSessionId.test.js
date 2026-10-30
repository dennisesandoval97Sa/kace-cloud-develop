import { ValueObjectSessionId } from '../../../src/users/domain/ValueObjectSessionId.js';

describe('ValueObjectSessionId', () => {
    it('accepts a non-empty string value (nullable defaulted, not passed)', () => {
        const vo = new ValueObjectSessionId('a-valid-session-id');

        expect(vo.value).toBe('a-valid-session-id');
    });

    it('accepts a non-empty string value when nullable is explicitly false', () => {
        const vo = new ValueObjectSessionId('a-valid-session-id', false);

        expect(vo.value).toBe('a-valid-session-id');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectSessionId('', false)).toThrow('session_id: The value cannot be null');
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectSessionId('', true);

        expect(vo.value).toBe('');
    });
});
