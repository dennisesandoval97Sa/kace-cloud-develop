import { applyTransformer, registerTransformer } from '../data/anonymizer/transformers.mjs';

describe('applyTransformer', () => {
    it('returns a non-empty string for fakeEmail', () => {
        const result = applyTransformer('fakeEmail', 'real@example.com');

        expect(typeof result).toBe('string');
        expect(result).toMatch(/.+@.+\..+/);
        expect(result).not.toBe('real@example.com');
    });

    it('returns a string with digits for fakePhone', () => {
        const result = applyTransformer('fakePhone', '+57 300 1234567');

        expect(typeof result).toBe('string');
        expect(result).toMatch(/\d/);
    });

    it('redacts to a fixed token for "redact"', () => {
        const result = applyTransformer('redact', 'sensitive-value');

        expect(result).toBe('[REDACTED]');
    });

    it('returns deterministic loremIpsum length irrespective of input', () => {
        const a = applyTransformer('loremIpsum', 'short');
        const b = applyTransformer('loremIpsum', 'a'.repeat(5000));

        expect(typeof a).toBe('string');
        expect(typeof b).toBe('string');
        expect(a.length).toBeGreaterThan(0);
    });

    it('throws on unknown transformer', () => {
        expect(() => applyTransformer('nonExistent', 'x')).toThrow(/unknown transformer/i);
    });

    it('allows registering a custom transformer at runtime', () => {
        registerTransformer('upper', (v) => String(v).toUpperCase());

        expect(applyTransformer('upper', 'foo')).toBe('FOO');
    });
});
