import { Filename } from '../../src/emails/domain/value-object/FileNameAttachment.js';

describe('Filename.sanitize', () => {
    it('uses the default fallback and default max length when no options are given', () => {
        expect(Filename.sanitize('***')).toBe('attachment');
        expect(Filename.sanitize(`${'a'.repeat(260)}.txt`)).toBe(`${'a'.repeat(251)}.txt`);
    });

    it('treats a null/undefined value as an empty string', () => {
        expect(Filename.sanitize(null)).toBe('attachment');
        expect(Filename.sanitize(undefined, { fallback: 'custom-fallback' })).toBe('custom-fallback');
    });

    it('falls back when the value is made up entirely of path separators', () => {
        expect(Filename.sanitize('///', { fallback: 'no-basename' })).toBe('no-basename');
    });

    it('falls back when sanitizing strips every character from the basename', () => {
        expect(Filename.sanitize('***???', { fallback: 'unsafe-name' })).toBe('unsafe-name');
    });

    it('returns the sanitized name unchanged when it is within the max length', () => {
        expect(Filename.sanitize('Invoice #1.PDF')).toBe('invoice-1.pdf');
    });

    it('truncates overlong names without a recognizable extension using the full max length', () => {
        const longNameNoExtension = 'b'.repeat(300);

        expect(Filename.sanitize(longNameNoExtension, { maxLength: 255 })).toBe('b'.repeat(255));
    });

    it('truncates overlong names preserving a short recognizable extension', () => {
        const longName = `${'c'.repeat(260)}.jpeg`;

        expect(Filename.sanitize(longName, { maxLength: 100 })).toBe(`${'c'.repeat(95)}.jpeg`);
    });
});
