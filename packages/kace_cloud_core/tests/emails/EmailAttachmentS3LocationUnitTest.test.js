import { EmailAttachmentS3Location } from '../../src/emails/domain/EmailAttachmentS3Location.js';

describe('EmailAttachmentS3Location', () => {
    it('parses an inbound-style S3 attachment url', () => {
        const url =
            'https://s3pruebaskace.s3.amazonaws.com/attachments/15a31cea-d426-4346-b28a-0edeecb22fef/154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf';

        const location = EmailAttachmentS3Location.fromUrl(url);

        expect(location).toEqual({
            folderId: '15a31cea-d426-4346-b28a-0edeecb22fef',
            basename: '154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf',
            cleanFilename: 'agentic-ai-serverless.pdf',
            key: 'attachments/15a31cea-d426-4346-b28a-0edeecb22fef/154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf',
        });
    });

    it('parses regional S3 hostnames (bucket.s3.us-east-1.amazonaws.com)', () => {
        const url =
            'https://mybucket.s3.us-east-1.amazonaws.com/attachments/abc-123/9aa4e0dc-651e-4441-8e54-aa1307acfab8_image.png';

        const location = EmailAttachmentS3Location.fromUrl(url);

        expect(location.folderId).toBe('abc-123');
        expect(location.basename).toBe('9aa4e0dc-651e-4441-8e54-aa1307acfab8_image.png');
        expect(location.cleanFilename).toBe('image.png');
    });

    it('parses dualstack S3 hostnames (bucket.s3.dualstack.us-east-1.amazonaws.com)', () => {
        const url =
            'https://mybucket.s3.dualstack.us-east-1.amazonaws.com/attachments/abc-123/9aa4e0dc-651e-4441-8e54-aa1307acfab8_image.png';

        const location = EmailAttachmentS3Location.fromUrl(url);

        expect(location.folderId).toBe('abc-123');
        expect(location.cleanFilename).toBe('image.png');
    });

    it('decodes URI-encoded basenames and ignores query params (presigned urls)', () => {
        const url =
            'https://mybucket.s3.amazonaws.com/attachments/abc-123/154b6906-c0ae-497b-a5cc-ad9227a12cc8_my%20file.pdf?X-Amz-Signature=zzz';

        const location = EmailAttachmentS3Location.fromUrl(url);

        expect(location.basename).toBe('154b6906-c0ae-497b-a5cc-ad9227a12cc8_my file.pdf');
        expect(location.cleanFilename).toBe('my file.pdf');
        expect(location.key).toBe('attachments/abc-123/154b6906-c0ae-497b-a5cc-ad9227a12cc8_my file.pdf');
    });

    it('keeps the full basename as cleanFilename when there is no uuid prefix', () => {
        const url = 'https://mybucket.s3.amazonaws.com/attachments/abc-123/plain-name.pdf';

        const location = EmailAttachmentS3Location.fromUrl(url);

        expect(location.cleanFilename).toBe('plain-name.pdf');
    });

    it('returns null for non-S3 public urls (legacy rows)', () => {
        expect(EmailAttachmentS3Location.fromUrl('https://www.nintendo.com/eu/media/images/Mario.png')).toBeNull();
    });

    it('returns null for S3 urls outside the attachments/ prefix', () => {
        expect(EmailAttachmentS3Location.fromUrl('https://mybucket.s3.amazonaws.com/emails/abc/body.html')).toBeNull();
    });

    it('returns null for malformed or empty input', () => {
        expect(EmailAttachmentS3Location.fromUrl(null)).toBeNull();
        expect(EmailAttachmentS3Location.fromUrl('')).toBeNull();
        expect(EmailAttachmentS3Location.fromUrl('not-a-url')).toBeNull();
    });

    it('returns null when decoded segments contain slashes (%2F)', () => {
        expect(
            EmailAttachmentS3Location.fromUrl('https://mybucket.s3.amazonaws.com/attachments/abc%2Fdef/file.pdf')
        ).toBeNull();
    });

    it('returns null for malformed percent-escapes in the basename', () => {
        expect(
            EmailAttachmentS3Location.fromUrl('https://mybucket.s3.amazonaws.com/attachments/abc/file%zz.pdf')
        ).toBeNull();
    });
});
