import { v4 as uuidV4 } from 'uuid';
import { EmailAttachment } from '../../src/emails/domain/EmailAttachments';
import { ValueObjectInt, ValueObjectString, ValueObjectUuid } from '../../src/shared';
import { ValueObjectURL } from '../../src/s3-files/domain/value-objects';
import { EmailAttachmentResponse } from '../../src/emails/application/EmailAttachmentResponse';
import { EmailAttachmentMother } from './domain/EmailAttachmentMother.js';

describe('EmailAttachment Entity', () => {
    const dto = EmailAttachmentMother.dto();

    it('should create an EmailAttachment with valid data', () => {
        const attachment = EmailAttachment.create(dto);

        expect(attachment.id).toBeInstanceOf(ValueObjectUuid);
        expect(attachment.email_id).toBeInstanceOf(ValueObjectUuid);
        expect(attachment.url).toBeInstanceOf(ValueObjectURL);
        expect(attachment.size).toBeInstanceOf(ValueObjectInt);
        expect(attachment.filename).toBeInstanceOf(ValueObjectString);

        expect(attachment.created_at).toBeDefined();
        expect(attachment.created_by).toBeDefined();
    });

    it('should create EmailAttachment with nullable filename when absent', () => {
        const attachment = EmailAttachment.create(EmailAttachmentMother.dto({ filename: null }));

        expect(attachment.filename.value).toBeNull();
    });

    it('defaults filename to null in create() when the field is omitted entirely', () => {
        const params = EmailAttachmentMother.dto();
        delete params.filename;

        const attachment = EmailAttachment.create(params);

        expect(attachment.filename.value).toBeNull();
    });

    it('defaults filename to null in the constructor when called directly without create()', () => {
        // `EmailAttachment.create()` has its own `filename = null` default, so it always
        // forwards a defined value (`null` at worst) to the constructor. The constructor's
        // own `filename = null` default is reachable only by calling it directly.
        const params = EmailAttachmentMother.dto();
        delete params.filename;

        const attachment = new EmailAttachment(params);

        expect(attachment.filename.value).toBeNull();
    });

    it('defaults deleted_at/deleted_by to null in the constructor when omitted', () => {
        const params = EmailAttachmentMother.dto();
        delete params.deleted_at;
        delete params.deleted_by;

        const attachment = new EmailAttachment(params);

        expect(attachment.deleted_at.value).toBeNull();
        expect(attachment.deleted_by.value).toBeNull();
    });

    it('generates a random id in create() when none is provided', () => {
        const params = EmailAttachmentMother.dto();
        delete params.id;

        const attachment = EmailAttachment.create(params);

        expect(attachment.id).toBeInstanceOf(ValueObjectUuid);
        expect(attachment.id.value).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    });

    it('defaults url to "default" when omitted', () => {
        const params = EmailAttachmentMother.dto();
        delete params.url;

        const attachment = EmailAttachment.create(params);

        expect(attachment.url.value).toBe('default');
    });

    it('should update filename and track changedAttributes', () => {
        const attachment = EmailAttachment.create(EmailAttachmentMother.dto({ filename: null }));

        attachment.filename = 'invoice-2026.pdf';

        expect(attachment.filename.value).toBe('invoice-2026.pdf');
        expect(attachment.changedAttributes).toEqual({ filename: 'invoice-2026.pdf' });
    });

    it('should update email_id and track changedAttributes', () => {
        const attachment = EmailAttachment.create(dto);
        const newEmailId = uuidV4();

        attachment.email_id = newEmailId;

        expect(attachment.email_id.value).toBe(newEmailId);
        expect(attachment.changedAttributes).toEqual({
            email_id: newEmailId,
        });
    });

    it('should update url and size and track changedAttributes', () => {
        const attachment = EmailAttachment.create(dto);

        attachment.url = 'https://cdn.example.com/new-file.png';
        attachment.size = 2048;

        expect(attachment.url.value).toBe('https://cdn.example.com/new-file.png');
        expect(attachment.size.value).toBe(2048);

        expect(attachment.changedAttributes).toEqual({
            url: 'https://cdn.example.com/new-file.png',
            size: 2048,
        });
    });

    it('flushes changes', () => {
        const attachment = EmailAttachment.create(dto);

        attachment.url = 'https://cdn.example.com/x.pdf';
        attachment.flushChanges();

        expect(attachment.changedAttributes).toEqual({});
    });

    it('marks EmailAttachment as deleted (soft-delete)', () => {
        const attachment = EmailAttachment.create(dto);
        const deleted_at = new Date().toISOString();
        const deleted_by = uuidV4();

        attachment.deleted_at = deleted_at;
        attachment.deleted_by = deleted_by;

        expect(attachment.deleted_at.value).toBe(deleted_at);
        expect(attachment.deleted_by.value).toBe(deleted_by);
    });

    it('should throw on invalid UUID id', () => {
        const invalid = EmailAttachmentMother.dto({ id: 'not-a-uuid' });

        expect(() => EmailAttachment.create(invalid)).toThrow(/Invalid value .* for object uuid/i);
    });

    it('should throw on invalid email_id UUID', () => {
        const invalid = EmailAttachmentMother.dto({ email_id: 'bad-uuid' });

        expect(() => EmailAttachment.create(invalid)).toThrow(/email_id/i);
    });

    it('should throw on invalid size', () => {
        const invalid = EmailAttachmentMother.dto({ size: 'big' });

        expect(() => EmailAttachment.create(invalid)).toThrow(/size/i);
    });
});

describe('EmailAttachmentResponse', () => {
    it('maps EmailAttachment aggregate to JSON', () => {
        const attachment = EmailAttachment.create(EmailAttachmentMother.dto());

        const response = new EmailAttachmentResponse(attachment).toJson();

        expect(response).toEqual({
            data: {
                id: attachment.id.value,
                email_id: attachment.email_id.value,
                url: attachment.url.value,
                size: attachment.size.value,
                filename: attachment.filename.value,
                name: attachment.filename.value,
                created_at: attachment.created_at.value,
                created_by: attachment.created_by.value,
                updated_at: null,
                updated_by: null,
            },
        });
    });

    it('returns empty object if EmailAttachment is null', () => {
        const response = new EmailAttachmentResponse(null).toJson();
        expect(response).toEqual({});
    });

    it('defaults created_at/created_by/updated_at/updated_by to null for a leaner projection lacking them', () => {
        // AggregateRoot.created_at/created_by are always set once a real EmailAttachment
        // is constructed via EmailAttachment.create(), so the `?.value ?? null` guards
        // here are unreachable through that path; they only fire for a hand-built
        // record shape (e.g. a projection assembled outside the aggregate).
        const attachment = EmailAttachment.create(EmailAttachmentMother.dto());
        const leanAttachment = {
            id: attachment.id,
            email_id: attachment.email_id,
            url: attachment.url,
            size: attachment.size,
            filename: attachment.filename,
        };

        const response = new EmailAttachmentResponse(leanAttachment).toJson();

        expect(response.data.created_at).toBeNull();
        expect(response.data.created_by).toBeNull();
        expect(response.data.updated_at).toBeNull();
        expect(response.data.updated_by).toBeNull();
    });
});
