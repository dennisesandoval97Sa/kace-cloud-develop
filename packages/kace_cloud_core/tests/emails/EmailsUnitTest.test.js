import { v4 as uuidV4 } from 'uuid';
import { ValueObjectJson, ValueObjectString, ValueObjectTimestamp, ValueObjectUuid } from '../../src/shared';
import { Email } from '../../src/emails/domain/Email';
import { EmailResponse } from '../../src/emails/application/EmailResponse';
import { EmailAttachment } from '../../src/emails/domain/EmailAttachments';
import { EmailBody } from '../../src/emails/domain/EmailBody';

class EmailMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            s3_key: 's3://emails/raw/123.eml',
            subject: 'Soporte técnico',
            sender: 'cliente@test.com',
            to: [{ email: 'agent@test.com', name: 'Agent' }],
            cc: [],
            bcc: [],
            priority: 'high',
            workspace_id: uuidV4(),
            message_id: '<msg-123@test.com>',
            thread_id: 'thread-123',
            account_id: uuidV4(),
            received_at: new Date().toISOString(),
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

class EmailBodyMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            email_id: uuidV4(),
            body: '<p>Contenido del email</p>',
            body_html: '<p>Contenido HTML del email</p>',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
            updated_at: null,
            updated_by: null,
            ...overrides,
        };
    }
}

class EmailAttachmentMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            email_id: uuidV4(),
            url: 'https://s3.amazonaws.com/bucket/file.pdf',
            size: 2048,
            filename: 'file.pdf',
            created_at: new Date().toISOString(),
            created_by: uuidV4(),
            updated_at: null,
            updated_by: null,
            ...overrides,
        };
    }
}

describe('Email Entity', () => {
    it('should create Email with valid data', () => {
        const a = Email.create(EmailMother.dto());

        expect(a.subject).toBeInstanceOf(ValueObjectString);
        expect(a.sender).toBeInstanceOf(ValueObjectString);
        expect(a.to).toBeInstanceOf(ValueObjectJson);
        expect(a.workspace_id).toBeInstanceOf(ValueObjectUuid);
        expect(a.received_at).toBeInstanceOf(ValueObjectTimestamp);
    });

    it('should update subject and track changes', () => {
        const a = Email.create(EmailMother.dto());

        a.subject = 'Nuevo asunto';

        expect(a.subject.value).toBe('Nuevo asunto');
        expect(a.changedAttributes.subject).toBe('Nuevo asunto');
    });

    it('should update recipients', () => {
        const a = Email.create(EmailMother.dto());

        const to = [{ email: 'new@test.com' }];
        a.to = to;

        expect(a.to.value).toEqual(to);
        expect(a.changedAttributes.to).toEqual(to);
    });

    it('should update priority', () => {
        const a = Email.create(EmailMother.dto());

        a.priority = 'low';

        expect(a.priority.value).toBe('low');
        expect(a.changedAttributes.priority).toBe('low');
    });

    it('flushes changes', () => {
        const a = Email.create(EmailMother.dto());
        a.subject = 'X';
        a.flushChanges();

        expect(a.changedAttributes).toEqual({});
    });

    it('should throw error on invalid workspace_id', () => {
        const dto = EmailMother.dto({ workspace_id: 'invalid' });
        expect(() => Email.create(dto)).toThrow();
    });

    it('defaults to/cc/bcc to empty arrays and is_outbound to false when omitted entirely', () => {
        const dto = EmailMother.dto();
        delete dto.to;
        delete dto.cc;
        delete dto.bcc;

        const a = Email.create(dto);

        expect(a.to.value).toEqual([]);
        expect(a.cc.value).toEqual([]);
        expect(a.bcc.value).toEqual([]);
        expect(a.is_outbound.value).toBe(false);
    });

    it('defaults is_outbound to false when it is explicitly null (bypassing the destructuring default)', () => {
        // `is_outbound = false` is already a default at the constructor's destructuring
        // level, so it only ever sees `undefined` when the field is omitted -- which the
        // destructuring default already resolves. The body's own `is_outbound ?? false`
        // guard is reachable only when the caller passes an explicit `null`.
        const a = Email.create(EmailMother.dto({ is_outbound: null }));

        expect(a.is_outbound.value).toBe(false);
    });

    it('updates is_outbound and marks changedAttributes, defaulting a nullish value to false', () => {
        const a = Email.create(EmailMother.dto());

        a.is_outbound = true;
        expect(a.is_outbound.value).toBe(true);
        expect(a.changedAttributes.is_outbound).toBe(true);

        a.is_outbound = undefined;
        expect(a.is_outbound.value).toBe(false);
    });
});

describe('EmailResponse', () => {
    it('maps Email aggregate to JSON without body and attachments', () => {
        const email = Email.create(EmailMother.dto());

        const json = new EmailResponse(email).toJson();

        expect(json).toEqual({
            data: {
                id: email.id.value,
                s3_key: email.s3_key.value,
                subject: email.subject.value,
                sender: email.sender.value,
                to: email.to.value,
                cc: email.cc.value,
                bcc: email.bcc.value,
                priority: email.priority.value,
                workspace_id: email.workspace_id.value,
                message_id: email.message_id.value,
                thread_id: email.thread_id.value,
                account_id: email.account_id.value,
                received_at: email.received_at.value,
                is_outbound: email.is_outbound.value,

                body: null,
                attachments: [],

                created_at: email.created_at.value,
                created_by: email.created_by.value,
                updated_at: email.updated_at.value,
                updated_by: email.updated_by.value,
            },
        });
    });

    it('returns empty object when email is null', () => {
        const json = new EmailResponse(null).toJson();
        expect(json).toEqual({});
    });

    it('maps Email aggregate with body and attachments', () => {
        const email = Email.create(EmailMother.dto());

        const body = EmailBody.create(EmailBodyMother.dto({ email_id: email.id.value }));

        const attachments = [EmailAttachment.create(EmailAttachmentMother.dto({ email_id: email.id.value }))];

        const json = new EmailResponse(email, body, attachments).toJson();

        expect(json).toEqual({
            data: {
                id: email.id.value,
                s3_key: email.s3_key.value,
                subject: email.subject.value,
                sender: email.sender.value,
                to: email.to.value,
                cc: email.cc.value,
                bcc: email.bcc.value,
                priority: email.priority.value,
                workspace_id: email.workspace_id.value,
                message_id: email.message_id.value,
                thread_id: email.thread_id.value,
                account_id: email.account_id.value,
                received_at: email.received_at.value,
                is_outbound: email.is_outbound.value,

                body: {
                    id: body.id.value,
                    email_id: email.id.value,
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
                        size_bytes: Buffer.byteLength(body.body_html.value, 'utf8'),
                        content_type: null,
                        preview_truncated: false,
                        bodyUrl: null,
                    },
                    created_at: body.created_at.value,
                    created_by: body.created_by.value,
                    updated_at: body.updated_at.value,
                    updated_by: body.updated_by.value,
                },

                attachments: [
                    {
                        id: attachments[0].id.value,
                        email_id: email.id.value,
                        url: attachments[0].url.value,
                        size: attachments[0].size.value,
                        filename: attachments[0].filename.value,
                        name: attachments[0].filename.value,
                        created_at: attachments[0].created_at.value,
                        created_by: attachments[0].created_by.value,
                        updated_at: attachments[0].updated_at.value,
                        updated_by: attachments[0].updated_by.value,
                    },
                ],

                created_at: email.created_at.value,
                created_by: email.created_by.value,
                updated_at: email.updated_at.value,
                updated_by: email.updated_by.value,
            },
        });
    });

    it('exposes is_outbound flag for outbound emails', () => {
        const email = Email.create(EmailMother.dto({ is_outbound: true }));

        const json = new EmailResponse(email).toJson();

        expect(json.data.is_outbound).toBe(true);
    });

    it('defaults is_outbound to false for inbound emails', () => {
        const email = Email.create(EmailMother.dto());

        const json = new EmailResponse(email).toJson();

        expect(json.data.is_outbound).toBe(false);
    });
});
