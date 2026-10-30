import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';
import { OutboundAttachmentPersister } from '../../src/emails/application/attachments/OutboundAttachmentPersister.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';

const S3_URL =
    'https://mybucket.s3.amazonaws.com/attachments/15a31cea-d426-4346-b28a-0edeecb22fef/154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf';
const PUBLIC_URL = 'https://www.nintendo.com/eu/media/images/Mario.png';

function buildPersister({ headResult, headError } = {}) {
    const attachmentStorage = {
        head: jest.fn(
            headError
                ? () => Promise.reject(headError)
                : () => Promise.resolve(headResult ?? { size: 2432353, contentType: 'application/pdf' })
        ),
    };
    const emailAttachmentRepository = { save: jest.fn().mockResolvedValue(undefined) };
    const persister = new OutboundAttachmentPersister({ emailAttachmentRepository, attachmentStorage });
    return { persister, attachmentStorage, emailAttachmentRepository };
}

describe('OutboundAttachmentPersister', () => {
    describe('prepare', () => {
        it('resolves filename and size via HEAD for kace S3 urls', async () => {
            const { persister, attachmentStorage } = buildPersister();

            const prepared = await persister.prepare([S3_URL]);

            expect(attachmentStorage.head).toHaveBeenCalledWith(
                'attachments/15a31cea-d426-4346-b28a-0edeecb22fef/154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf'
            );
            expect(prepared).toEqual([{ url: S3_URL, filename: 'agentic-ai-serverless.pdf', size: 2432353 }]);
        });

        it('passes through non-S3 urls without HEAD (legacy behavior)', async () => {
            const { persister, attachmentStorage } = buildPersister();

            const prepared = await persister.prepare([PUBLIC_URL]);

            expect(attachmentStorage.head).not.toHaveBeenCalled();
            expect(prepared).toEqual([{ url: PUBLIC_URL, filename: null, size: 0 }]);
        });

        it('throws CustomError 422 when the S3 object does not exist', async () => {
            const notFound = new Error('NotFound');
            notFound.name = 'NotFound';
            const { persister } = buildPersister({ headError: notFound });

            await expect(persister.prepare([S3_URL])).rejects.toBeInstanceOf(CustomError);
            await expect(persister.prepare([S3_URL])).rejects.toMatchObject({
                statusCode: 422,
                message: `Attachment not found in storage: ${S3_URL}`,
            });
        });

        it('treats SDK errors with httpStatusCode 404 as not found', async () => {
            const notFound = new Error('no such key');
            notFound.$metadata = { httpStatusCode: 404 };
            const { persister } = buildPersister({ headError: notFound });

            await expect(persister.prepare([S3_URL])).rejects.toMatchObject({ statusCode: 422 });
        });

        it('rethrows non-404 storage failures as 502 without claiming not found', async () => {
            const denied = new Error('AccessDenied');
            denied.name = 'AccessDenied';
            denied.$metadata = { httpStatusCode: 403 };
            const { persister } = buildPersister({ headError: denied });

            await expect(persister.prepare([S3_URL])).rejects.toMatchObject({
                statusCode: 502,
                message: `Failed to read attachment from storage: ${S3_URL}`,
            });
        });

        it('handles a mixed list of S3 and public urls preserving order', async () => {
            const { persister, attachmentStorage } = buildPersister();

            const prepared = await persister.prepare([PUBLIC_URL, S3_URL]);

            expect(attachmentStorage.head).toHaveBeenCalledTimes(1);
            expect(prepared.map((a) => a.url)).toEqual([PUBLIC_URL, S3_URL]);
        });

        it('defaults size to 0 when the storage HEAD response omits it', async () => {
            const { persister } = buildPersister({ headResult: { contentType: 'application/pdf' } });

            const prepared = await persister.prepare([S3_URL]);

            expect(prepared[0].size).toBe(0);
        });

        it('returns empty array for empty or missing input', async () => {
            const { persister } = buildPersister();

            expect(await persister.prepare([])).toEqual([]);
            expect(await persister.prepare()).toEqual([]);
        });

        it('resolves multiple S3 heads in parallel preserving input order', async () => {
            const otherS3Url =
                'https://mybucket.s3.amazonaws.com/attachments/abc-123/9aa4e0dc-651e-4441-8e54-aa1307acfab8_image.png';
            const attachmentStorage = {
                // Resolve the first call slower than the second to prove order comes
                // from the input array, not from completion timing (parallel, not serial).
                head: jest
                    .fn()
                    .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({ size: 10 }), 20)))
                    .mockImplementationOnce(() => Promise.resolve({ size: 20 })),
            };
            const persister = new OutboundAttachmentPersister({
                emailAttachmentRepository: { save: jest.fn() },
                attachmentStorage,
            });

            const prepared = await persister.prepare([S3_URL, otherS3Url]);

            expect(prepared.map((a) => a.url)).toEqual([S3_URL, otherS3Url]);
            expect(prepared.map((a) => a.size)).toEqual([10, 20]);
        });

        it('rejects with the per-attachment CustomError when any head fails', async () => {
            const notFound = new Error('NotFound');
            notFound.name = 'NotFound';
            const attachmentStorage = {
                head: jest.fn().mockResolvedValueOnce({ size: 10 }).mockRejectedValueOnce(notFound),
            };
            const persister = new OutboundAttachmentPersister({
                emailAttachmentRepository: { save: jest.fn() },
                attachmentStorage,
            });
            const otherS3Url =
                'https://mybucket.s3.amazonaws.com/attachments/abc-123/9aa4e0dc-651e-4441-8e54-aa1307acfab8_image.png';

            await expect(persister.prepare([S3_URL, otherS3Url])).rejects.toMatchObject({ statusCode: 422 });
        });
    });

    describe('persist', () => {
        it('saves one EmailAttachment per prepared attachment with real metadata', async () => {
            const { persister, emailAttachmentRepository } = buildPersister();
            const emailId = uuidV4();
            const userId = uuidV4();
            const now = new Date();

            await persister.persist({
                emailId,
                attachments: [{ url: S3_URL, filename: 'agentic-ai-serverless.pdf', size: 2432353 }],
                userId,
                now,
            });

            expect(emailAttachmentRepository.save).toHaveBeenCalledTimes(1);
            const saved = emailAttachmentRepository.save.mock.calls[0][0];
            expect(saved.email_id.value).toBe(emailId);
            expect(saved.url.value).toBe(S3_URL);
            expect(saved.filename.value).toBe('agentic-ai-serverless.pdf');
            expect(saved.size.value).toBe(2432353);
            expect(saved.created_by.value).toBe(userId);
        });

        it('does nothing when attachments is omitted', async () => {
            const { persister, emailAttachmentRepository } = buildPersister();

            await persister.persist({ emailId: uuidV4(), userId: uuidV4(), now: new Date() });

            expect(emailAttachmentRepository.save).not.toHaveBeenCalled();
        });
    });
});
