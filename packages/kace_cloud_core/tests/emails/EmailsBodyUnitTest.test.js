import { v4 as uuidV4 } from 'uuid';
import { EmailBody } from '../../src/emails/domain/EmailBody';
import { ValueObjectUuid } from '../../src/shared';
import { ValueObjectEmailBody } from '../../src/emails/domain/value-object/ValueObjectEmailBody.js';
import { EmailBodyResponse } from '../../src/emails/application/EmailResponseBody.js';

class EmailBodyMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            email_id: uuidV4(),
            body: 'Este es el cuerpo del correo',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }
}

describe('EmailBody Entity', () => {
    it('should create EmailBody with valid data', () => {
        const dto = EmailBodyMother.dto();
        const a = EmailBody.create(dto);

        expect(a).toBeInstanceOf(EmailBody);
        expect(a.email_id).toBeInstanceOf(ValueObjectUuid);
        expect(a.body).toBeInstanceOf(ValueObjectEmailBody);
        expect(a.body.value).toBe(dto.body);
    });

    it('generates a random id when none is provided', () => {
        const dto = EmailBodyMother.dto();
        delete dto.id;

        const a = EmailBody.create(dto);

        expect(a.id).toBeInstanceOf(ValueObjectUuid);
        expect(a.id.value).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    });

    it('should create EmailBody with nullable HTML body when absent', () => {
        const body = EmailBody.create(EmailBodyMother.dto({ body_html: null }));

        expect(body.body_html.value).toBeNull();
    });

    it('should create EmailBody with original HTML body when present', () => {
        const html = '<main><h1>Hello</h1><script>alert("stored-original")</script></main>';
        const body = EmailBody.create(EmailBodyMother.dto({ body_html: html }));

        expect(body.body_html).toBeInstanceOf(ValueObjectEmailBody);
        expect(body.body_html.value).toBe(html);
    });

    it('should update body and mark changedAttributes', () => {
        const a = EmailBody.create(EmailBodyMother.dto());

        const newBody = 'Nuevo contenido del email';
        a.body = newBody;

        expect(a.body.value).toBe(newBody);
        expect(a.changedAttributes).toEqual({ body: newBody });
    });

    it('should update body_html and mark changedAttributes', () => {
        const body = EmailBody.create(EmailBodyMother.dto({ body_html: null }));
        const html = '<p>Updated HTML</p>';

        body.body_html = html;

        expect(body.body_html.value).toBe(html);
        expect(body.changedAttributes).toEqual({ body_html: html });
    });

    it('should update email_id and mark changedAttributes', () => {
        const a = EmailBody.create(EmailBodyMother.dto());
        const newEmailId = uuidV4();

        a.email_id = newEmailId;

        expect(a.email_id.value).toBe(newEmailId);
        expect(a.changedAttributes.email_id).toBe(newEmailId);
    });

    it('should throw error for invalid email_id', () => {
        const dto = EmailBodyMother.dto({ email_id: 'not-uuid' });
        expect(() => EmailBody.create(dto)).toThrow();
    });

    it('throws when the (non-nullable) body is null', () => {
        const dto = EmailBodyMother.dto({ body: null });
        expect(() => EmailBody.create(dto)).toThrow('body: The email body cannot be null');
    });

    it('coerces a non-string body value to a string', () => {
        const body = EmailBody.create(EmailBodyMother.dto({ body: 12345 }));
        expect(body.body.value).toBe('12345');
    });

    it('flushes changes', () => {
        const a = EmailBody.create(EmailBodyMother.dto());
        a.body = 'Cambio';
        a.flushChanges();

        expect(a.changedAttributes).toEqual({});
    });

    it('updates every external-storage metadata setter and marks changedAttributes', () => {
        const a = EmailBody.create(EmailBodyMother.dto());

        a.body_text_storage_mode = 'external';
        expect(a.body_text_storage_mode.value).toBe('external');
        expect(a.changedAttributes.body_text_storage_mode).toBe('external');

        a.body_text_s3_key = 'email-bodies/id/text.txt';
        expect(a.body_text_s3_key.value).toBe('email-bodies/id/text.txt');
        expect(a.changedAttributes.body_text_s3_key).toBe('email-bodies/id/text.txt');

        a.body_text_size_bytes = '2048';
        expect(a.body_text_size_bytes.value).toBe(2048);
        expect(a.changedAttributes.body_text_size_bytes).toBe(2048);

        a.body_text_content_type = 'text/plain; charset=utf-8';
        expect(a.body_text_content_type.value).toBe('text/plain; charset=utf-8');
        expect(a.changedAttributes.body_text_content_type).toBe('text/plain; charset=utf-8');

        a.body_text_sha256 = 'text-sha';
        expect(a.body_text_sha256.value).toBe('text-sha');
        expect(a.changedAttributes.body_text_sha256).toBe('text-sha');

        a.body_text_preview_truncated = true;
        expect(a.body_text_preview_truncated.value).toBe(true);
        expect(a.changedAttributes.body_text_preview_truncated).toBe(true);

        a.body_html_storage_mode = 'external';
        expect(a.body_html_storage_mode.value).toBe('external');
        expect(a.changedAttributes.body_html_storage_mode).toBe('external');

        a.body_html_s3_key = 'email-bodies/id/html.html';
        expect(a.body_html_s3_key.value).toBe('email-bodies/id/html.html');
        expect(a.changedAttributes.body_html_s3_key).toBe('email-bodies/id/html.html');

        a.body_html_size_bytes = 'not-a-number';
        expect(a.body_html_size_bytes.value).toBeNull();
        expect(a.changedAttributes.body_html_size_bytes).toBeNull();

        a.body_html_content_type = 'text/html; charset=utf-8';
        expect(a.body_html_content_type.value).toBe('text/html; charset=utf-8');
        expect(a.changedAttributes.body_html_content_type).toBe('text/html; charset=utf-8');

        a.body_html_sha256 = 'html-sha';
        expect(a.body_html_sha256.value).toBe('html-sha');
        expect(a.changedAttributes.body_html_sha256).toBe('html-sha');

        a.body_html_preview_truncated = false;
        expect(a.body_html_preview_truncated.value).toBe(false);
        expect(a.changedAttributes.body_html_preview_truncated).toBe(false);
    });

    it('coerces preview_truncated flags outside the known literals using generic Boolean()', () => {
        const truthyBody = EmailBody.create(EmailBodyMother.dto({ body_text_preview_truncated: 'yes' }));
        expect(truthyBody.body_text_preview_truncated.value).toBe(true);

        const falsyBody = EmailBody.create(EmailBodyMother.dto({ body_html_preview_truncated: '' }));
        expect(falsyBody.body_html_preview_truncated.value).toBe(false);
    });

    // `EmailBody.create()` always forwards its own resolved defaults (e.g. `null`) to the
    // constructor, and KnexEmailsBodyRepository maps full Postgres rows (columns are always
    // present, `null` at worst) — so the constructor's own default parameters (`= null`,
    // `= false`) never fire via either real call path. The constructor is itself a public
    // export with an explicit optional-params contract, so we exercise it directly here to
    // guard that contract from regressing.
    it('applies the constructor defaults when the optional fields are omitted entirely', () => {
        const dto = EmailBodyMother.dto();
        const minimalParams = {
            id: dto.id,
            email_id: dto.email_id,
            body: dto.body,
            created_at: dto.created_at,
            created_by: dto.created_by,
            updated_at: dto.updated_at,
            updated_by: dto.updated_by,
        };

        const emailBody = new EmailBody(minimalParams);

        expect(emailBody.body_html.value).toBeNull();
        expect(emailBody.body_text_storage_mode.value).toBeNull();
        expect(emailBody.body_text_s3_key.value).toBeNull();
        expect(emailBody.body_text_size_bytes.value).toBeNull();
        expect(emailBody.body_text_content_type.value).toBeNull();
        expect(emailBody.body_text_sha256.value).toBeNull();
        expect(emailBody.body_text_preview_truncated.value).toBe(false);
        expect(emailBody.body_html_storage_mode.value).toBeNull();
        expect(emailBody.body_html_s3_key.value).toBeNull();
        expect(emailBody.body_html_size_bytes.value).toBeNull();
        expect(emailBody.body_html_content_type.value).toBeNull();
        expect(emailBody.body_html_sha256.value).toBeNull();
        expect(emailBody.body_html_preview_truncated.value).toBe(false);
    });
});

describe('EmailBodyResponse', () => {
    it('maps legacy EmailBody aggregate to inline JSON metadata', () => {
        const body = EmailBody.create(EmailBodyMother.dto());

        const response = new EmailBodyResponse(body).toJson();

        expect(response).toEqual({
            data: {
                id: body.id.value,
                email_id: body.email_id.value,
                body: body.body.value,
                body_html: body.body_html.value,
                text: {
                    mode: 'inline',
                    size_bytes: Buffer.byteLength(body.body.value, 'utf8'),
                    content_type: null,
                    preview_truncated: false,
                    bodyUrl: null,
                },
                html: {
                    mode: 'inline',
                    size_bytes: null,
                    content_type: null,
                    preview_truncated: false,
                    bodyUrl: null,
                },
                created_at: body.created_at.value,
                created_by: body.created_by.value,
                updated_at: null,
                updated_by: null,
            },
        });
    });

    it('maps external body metadata without exposing raw S3 keys', () => {
        const emailId = uuidV4();
        const body = EmailBody.create(
            EmailBodyMother.dto({
                email_id: emailId,
                body: 'Preview text',
                body_html: null,
                body_text_storage_mode: 'external',
                body_text_s3_key: 'email-bodies/email-id/text.txt',
                body_text_size_bytes: 2_000_000,
                body_text_content_type: 'text/plain; charset=utf-8',
                body_text_preview_truncated: true,
                body_html_storage_mode: 'external',
                body_html_s3_key: 'email-bodies/email-id/html.html',
                body_html_size_bytes: 2_500_000,
                body_html_content_type: 'text/html; charset=utf-8',
                body_html_preview_truncated: true,
            })
        );

        const response = new EmailBodyResponse(body).toJson();

        expect(response.data.body).toBe('Preview text');
        expect(response.data.body_html).toBeNull();
        expect(response.data.text).toEqual({
            mode: 'external',
            size_bytes: 2_000_000,
            content_type: 'text/plain; charset=utf-8',
            preview_truncated: true,
            bodyUrl: `/emails/${emailId}/body?part=text`,
        });
        expect(response.data.html).toEqual({
            mode: 'external',
            size_bytes: 2_500_000,
            content_type: 'text/html; charset=utf-8',
            preview_truncated: true,
            bodyUrl: `/emails/${emailId}/body?part=html`,
        });
        expect(JSON.stringify(response)).not.toContain('email-bodies/email-id');
    });

    it('returns empty object if EmailBody is null', () => {
        const response = new EmailBodyResponse(null).toJson();
        expect(response).toEqual({});
    });
});
