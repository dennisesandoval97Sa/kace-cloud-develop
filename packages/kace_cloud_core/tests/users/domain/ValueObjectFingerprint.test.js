import { ValueObjectFingerprint } from '../../../src/users/domain/ValueObjectFingerprint.js';

describe('ValueObjectFingerprint', () => {
    it('accepts a non-empty string value (nullable defaulted, not passed)', () => {
        const vo = new ValueObjectFingerprint('fingerprint', 'abc123');

        expect(vo.value).toBe('abc123');
    });

    it('accepts a non-empty string value when nullable is explicitly true', () => {
        const vo = new ValueObjectFingerprint('fingerprint', 'abc123', true);

        expect(vo.value).toBe('abc123');
    });

    it('accepts a non-empty string value when nullable is explicitly false', () => {
        const vo = new ValueObjectFingerprint('fingerprint', 'abc123', false);

        expect(vo.value).toBe('abc123');
    });

    it('throws when the value is falsy and nullable is false', () => {
        expect(() => new ValueObjectFingerprint('fingerprint', '', false)).toThrow(
            'fingerprint: The value cannot be null'
        );
    });

    it('returns without a value when the value is falsy and nullable is true', () => {
        const vo = new ValueObjectFingerprint('fingerprint', '', true);

        expect(vo.value).toBe('');
    });

    it('rejects a non-string value', () => {
        expect(() => new ValueObjectFingerprint('fingerprint', 12345, false)).toThrow();
    });
});
