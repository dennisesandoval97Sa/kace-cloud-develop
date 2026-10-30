import { extractChannelHubOriginalFilename } from '../../src/channel-hub-inbound-emails/application/ChannelHubAttachmentFilename.js';

describe('extractChannelHubOriginalFilename', () => {
    it('returns the suffix after the underscore when the prefix is a long Channel Hub-generated identifier', () => {
        const longPrefix = 'a'.repeat(151);
        const filename = `${longPrefix}_invoice.pdf`;

        const result = extractChannelHubOriginalFilename(filename);

        expect(result).toBe('invoice.pdf');
    });

    it('returns the original filename unchanged when it has no underscore', () => {
        const result = extractChannelHubOriginalFilename('invoice.pdf');

        expect(result).toBe('invoice.pdf');
    });

    it('returns the original filename when the prefix before the underscore is short', () => {
        const filename = 'short_invoice.pdf';

        const result = extractChannelHubOriginalFilename(filename);

        expect(result).toBe('short_invoice.pdf');
    });

    it('returns the original filename when the long prefix suffix does not look like a file extension', () => {
        const longPrefix = 'a'.repeat(151);
        const filename = `${longPrefix}_not-an-extension-suffix-with-too-many-characters`;

        const result = extractChannelHubOriginalFilename(filename);

        expect(result).toBe(filename);
    });

    it('treats a non-string input as an empty string instead of throwing', () => {
        const result = extractChannelHubOriginalFilename(undefined);

        expect(result).toBe('');
    });
});
