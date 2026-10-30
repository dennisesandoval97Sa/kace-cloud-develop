import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';
import { EmailBodyContentReader } from '../../src/emails/application/body/EmailBodyContentReader.js';
import { EmailBody } from '../../src/emails/domain/EmailBody.js';

function body(overrides = {}) {
    return EmailBody.create({
        id: uuidV4(),
        email_id: overrides.email_id ?? uuidV4(),
        body: 'Inline text body',
        body_html: '<p>Inline HTML body</p>',
        created_at: new Date().toISOString(),
        created_by: uuidV4(),
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
        ...overrides,
    });
}

function reader({ email = { isDeleted: () => false }, emailBody, bodyStorage = {} } = {}) {
    return new EmailBodyContentReader({
        emailRepository: {
            find: jest.fn().mockResolvedValue(email),
        },
        emailBodyRepository: {
            find: jest.fn().mockResolvedValue(emailBody),
        },
        bodyStorage,
    });
}

describe('EmailBodyContentReader', () => {
    it('returns inline text body content from the database', async () => {
        const emailId = uuidV4();
        const emailBody = body({
            email_id: emailId,
            body: 'Hello inline text',
            body_text_content_type: 'text/plain; charset=utf-8',
        });

        const result = await reader({ emailBody }).execute({ emailId, part: 'text' });

        expect(result).toEqual({
            email_id: emailId,
            part: 'text',
            mode: 'inline',
            content: 'Hello inline text',
            content_type: 'text/plain; charset=utf-8',
        });
    });

    it('downloads external HTML body content from storage', async () => {
        const emailId = uuidV4();
        const bodyStorage = {
            download: jest.fn().mockResolvedValue({
                content: '<article>Full external HTML</article>',
                contentType: 'text/html; charset=utf-8',
            }),
        };
        const emailBody = body({
            email_id: emailId,
            body_html: null,
            body_html_storage_mode: 'external',
            body_html_s3_key: 'email-bodies/email-id/html.html',
            body_html_content_type: 'text/html; charset=utf-8',
        });

        const result = await reader({ emailBody, bodyStorage }).execute({ emailId, part: 'html' });

        expect(bodyStorage.download).toHaveBeenCalledWith('email-bodies/email-id/html.html');
        expect(result).toEqual({
            email_id: emailId,
            part: 'html',
            mode: 'external',
            content: '<article>Full external HTML</article>',
            content_type: 'text/html; charset=utf-8',
        });
    });

    it('rejects unsupported body parts', async () => {
        const emailBody = body();

        await expect(reader({ emailBody }).execute({ emailId: uuidV4(), part: 'attachment' })).rejects.toMatchObject({
            message: 'Email body part must be text or html.',
            statusCode: 400,
        });
    });

    it('rejects external rows missing a storage key', async () => {
        const emailId = uuidV4();
        const emailBody = body({
            email_id: emailId,
            body_text_storage_mode: 'external',
            body_text_s3_key: null,
        });

        await expect(reader({ emailBody }).execute({ emailId, part: 'text' })).rejects.toMatchObject({
            message: 'External email body storage key is missing.',
            statusCode: 500,
        });
    });

    it('treats a missing/blank part as unsupported', async () => {
        const emailBody = body();

        await expect(reader({ emailBody }).execute({ emailId: uuidV4(), part: undefined })).rejects.toMatchObject({
            message: 'Email body part must be text or html.',
            statusCode: 400,
        });
    });

    it('rejects when the email does not exist', async () => {
        const emailBody = body();

        await expect(
            reader({ email: null, emailBody }).execute({ emailId: uuidV4(), part: 'text' })
        ).rejects.toMatchObject({
            message: 'Email not found',
            statusCode: 404,
        });
    });

    it('rejects when the email body row does not exist', async () => {
        await expect(reader({ emailBody: null }).execute({ emailId: uuidV4(), part: 'text' })).rejects.toMatchObject({
            message: 'Email body not found',
            statusCode: 404,
        });
    });

    it('returns inline HTML body content from the database', async () => {
        const emailId = uuidV4();
        const emailBody = body({
            email_id: emailId,
            body_html: '<p>Inline HTML only</p>',
            body_html_content_type: 'text/html; charset=utf-8',
        });

        const result = await reader({ emailBody }).execute({ emailId, part: 'html' });

        expect(result).toEqual({
            email_id: emailId,
            part: 'html',
            mode: 'inline',
            content: '<p>Inline HTML only</p>',
            content_type: 'text/html; charset=utf-8',
        });
    });

    it('rejects external body reads when no body storage is configured', async () => {
        const emailId = uuidV4();
        const emailBody = body({
            email_id: emailId,
            body_text_storage_mode: 'external',
            body_text_s3_key: 'email-bodies/email-id/text.txt',
        });

        await expect(reader({ emailBody, bodyStorage: null }).execute({ emailId, part: 'text' })).rejects.toMatchObject(
            {
                message: 'Email body storage is not configured.',
                statusCode: 500,
            }
        );
    });

    it('reads external content from a raw Buffer when the storage port has no "content" field', async () => {
        const emailId = uuidV4();
        const bodyStorage = { download: jest.fn().mockResolvedValue({ buffer: Buffer.from('raw buffer text') }) };
        const emailBody = body({
            email_id: emailId,
            body_text_storage_mode: 'external',
            body_text_s3_key: 'email-bodies/email-id/text.txt',
        });

        const result = await reader({ emailBody, bodyStorage }).execute({ emailId, part: 'text' });

        expect(result.content).toBe('raw buffer text');
        expect(result.content_type).toBe('text/plain; charset=utf-8');
    });

    it('defaults to empty content and the fallback content type when storage returns neither', async () => {
        const emailId = uuidV4();
        const bodyStorage = { download: jest.fn().mockResolvedValue({}) };
        const emailBody = body({
            email_id: emailId,
            body_html: null,
            body_html_storage_mode: 'external',
            body_html_s3_key: 'email-bodies/email-id/html.html',
        });

        const result = await reader({ emailBody, bodyStorage }).execute({ emailId, part: 'html' });

        expect(result.content).toBe('');
        expect(result.content_type).toBe('text/html; charset=utf-8');
    });
});
