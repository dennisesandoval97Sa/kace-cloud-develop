import { jest } from '@jest/globals';
import { WebhookMapper } from '../../../../src/interactions/application/WebhookMapper/WebhookMapper.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('WebhookMapper', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    describe('toEmailDTO', () => {
        it('maps every field from a fully populated payload', () => {
            const payload = {
                destination: { to: ['a@example.com'], cc: ['b@example.com'], bcc: ['c@example.com'] },
                content: { text: 'Hola mundo' },
                s3_key: 'bucket/key.eml',
                subject: 'Asunto de prueba',
                origin: 'sender@example.com',
                priority: 'high',
                messageIdOperator: 'operator-msg-id',
                messageId: 'raw-msg-id',
                received_at: '2026-01-01T00:00:00.000Z',
                attachments: [{ url: 'https://x/file.pdf', size: 10 }],
                created_at: '2026-01-02T00:00:00.000Z',
                created_by: 'user-1',
            };

            const dto = WebhookMapper.toEmailDTO(payload, 'workspace-1');

            expect(dto.s3_key).toEqual('bucket/key.eml');
            expect(dto.subject).toEqual('Asunto de prueba');
            expect(dto.sender).toEqual('sender@example.com');
            expect(dto.to).toEqual(['a@example.com']);
            expect(dto.cc).toEqual(['b@example.com']);
            expect(dto.bcc).toEqual(['c@example.com']);
            expect(dto.priority).toEqual('high');
            expect(dto.workspace_id).toEqual('workspace-1');
            // messageIdOperator must win over messageId when both are present.
            expect(dto.message_id).toEqual('operator-msg-id');
            expect(dto.received_at).toEqual('2026-01-01T00:00:00.000Z');
            expect(dto.body).toEqual({ body: 'Hola mundo' });
            expect(dto.attachments).toEqual([{ url: 'https://x/file.pdf', size: 10 }]);
            expect(dto.created_at).toEqual('2026-01-02T00:00:00.000Z');
            expect(dto.created_by).toEqual('user-1');
            expect(dto.updated_at).toBeNull();
            expect(dto.updated_by).toBeNull();
            expect(dto.deleted_at).toBeNull();
            expect(dto.deleted_by).toBeNull();
            expect(dto.id).toMatch(UUID_V4_REGEX);
        });

        it('falls back to messageId when messageIdOperator is absent', () => {
            const payload = { messageId: 'raw-msg-id' };

            const dto = WebhookMapper.toEmailDTO(payload, 'workspace-1');

            expect(dto.message_id).toEqual('raw-msg-id');
        });

        it('generates a message id when neither messageIdOperator nor messageId are present', () => {
            const dto = WebhookMapper.toEmailDTO({}, 'workspace-1');

            expect(dto.message_id).toMatch(UUID_V4_REGEX);
        });

        it('fills every optional field with its documented default on an empty payload', () => {
            jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

            const dto = WebhookMapper.toEmailDTO({}, undefined);

            expect(dto.s3_key).toBeNull();
            expect(dto.subject).toBeNull();
            expect(dto.sender).toBeNull();
            expect(dto.to).toEqual([]);
            expect(dto.cc).toEqual([]);
            expect(dto.bcc).toEqual([]);
            expect(dto.priority).toEqual('low');
            expect(dto.workspace_id).toBeNull();
            expect(dto.received_at).toEqual(new Date('2026-03-15T10:00:00.000Z'));
            expect(dto.body).toEqual({ body: null });
            expect(dto.attachments).toEqual([]);
            expect(dto.created_at).toEqual(new Date('2026-03-15T10:00:00.000Z'));
            expect(dto.created_by).toBeNull();
        });

        it('normalizes a single non-array recipient into a one-element array', () => {
            const payload = { destination: { to: 'single@example.com' } };

            const dto = WebhookMapper.toEmailDTO(payload, 'workspace-1');

            expect(dto.to).toEqual(['single@example.com']);
            // cc/bcc were not provided at all: they must resolve to the falsy branch, not the array branch.
            expect(dto.cc).toEqual([]);
            expect(dto.bcc).toEqual([]);
        });

        it('passes an already-array recipient through unchanged', () => {
            const payload = { destination: { to: ['x@example.com', 'y@example.com'] } };

            const dto = WebhookMapper.toEmailDTO(payload, 'workspace-1');

            expect(dto.to).toEqual(['x@example.com', 'y@example.com']);
        });

        it('uses an empty content object when content is missing, so body.body is null', () => {
            const dto = WebhookMapper.toEmailDTO({ destination: {} }, 'workspace-1');

            expect(dto.body).toEqual({ body: null });
        });
    });

    describe('toInteractionDTO', () => {
        it('maps every field from a fully populated payload', () => {
            const payload = {
                channel_id: 'email',
                client_identifier: 'client-1',
                external_identifier: 'ext-1',
                description: 'Descripcion de prueba',
                priority: 'urgent',
                workspace_id: 'workspace-1',
                conversation_id: 'conversation-1',
                created_at: '2026-01-02T00:00:00.000Z',
                created_by: 'user-1',
            };

            const dto = WebhookMapper.toInteractionDTO(payload);

            expect(dto.channel_id).toEqual('email');
            expect(dto.client_identifier).toEqual('client-1');
            expect(dto.external_identifier).toEqual('ext-1');
            expect(dto.description).toEqual('Descripcion de prueba');
            expect(dto.priority).toEqual('urgent');
            expect(dto.is_closed).toBe(false);
            expect(dto.start_review_at).toBeNull();
            expect(dto.start_review_by).toBeNull();
            expect(dto.workspace_id).toEqual('workspace-1');
            expect(dto.conversation_id).toEqual('conversation-1');
            expect(dto.created_at).toEqual('2026-01-02T00:00:00.000Z');
            expect(dto.created_by).toEqual('user-1');
            expect(dto.updated_at).toBeNull();
            expect(dto.updated_by).toBeNull();
            expect(dto.deleted_at).toBeNull();
            expect(dto.deleted_by).toBeNull();
            expect(dto.id).toMatch(UUID_V4_REGEX);
        });

        it('fills every optional field with its documented default on an empty payload', () => {
            jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

            const dto = WebhookMapper.toInteractionDTO({});

            expect(dto.channel_id).toBeNull();
            expect(dto.client_identifier).toBeNull();
            expect(dto.external_identifier).toBeNull();
            expect(dto.description).toBeNull();
            expect(dto.priority).toEqual('normal');
            expect(dto.workspace_id).toBeNull();
            expect(dto.conversation_id).toBeNull();
            expect(dto.created_at).toEqual(new Date('2026-03-15T10:00:00.000Z'));
            expect(dto.created_by).toBeNull();
        });
    });

    describe('toEmailBodyDTO', () => {
        it('returns null when the payload has no body', () => {
            expect(WebhookMapper.toEmailBodyDTO({}, 'email-1')).toBeNull();
        });

        it('maps the body content and the given email id when present', () => {
            const payload = {
                body: 'Contenido del correo',
                created_at: '2026-01-02T00:00:00.000Z',
                created_by: 'user-1',
            };

            const dto = WebhookMapper.toEmailBodyDTO(payload, 'email-1');

            expect(dto.email_id).toEqual('email-1');
            expect(dto.body).toEqual('Contenido del correo');
            expect(dto.created_at).toEqual('2026-01-02T00:00:00.000Z');
            expect(dto.created_by).toEqual('user-1');
            expect(dto.updated_at).toBeNull();
            expect(dto.updated_by).toBeNull();
            expect(dto.deleted_at).toBeNull();
            expect(dto.deleted_by).toBeNull();
            expect(dto.id).toMatch(UUID_V4_REGEX);
        });

        it('defaults created_at/created_by when absent from a payload that does have a body', () => {
            jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

            const dto = WebhookMapper.toEmailBodyDTO({ body: 'x' }, 'email-1');

            expect(dto.created_at).toEqual(new Date('2026-03-15T10:00:00.000Z'));
            expect(dto.created_by).toBeNull();
        });
    });

    describe('toAttachmentDTOs', () => {
        it('returns an empty array when there are no attachments', () => {
            expect(WebhookMapper.toAttachmentDTOs({}, 'email-1')).toEqual([]);
        });

        it('returns an empty array when attachments is an empty array', () => {
            expect(WebhookMapper.toAttachmentDTOs({ attachments: [] }, 'email-1')).toEqual([]);
        });

        it('maps every attachment field, including per-attachment url/size', () => {
            const payload = {
                attachments: [
                    { url: 'https://x/one.pdf', size: 10 },
                    { url: 'https://x/two.pdf', size: 20 },
                ],
                created_at: '2026-01-02T00:00:00.000Z',
                created_by: 'user-1',
            };

            const dtos = WebhookMapper.toAttachmentDTOs(payload, 'email-1');

            expect(dtos).toHaveLength(2);
            expect(dtos[0].email_id).toEqual('email-1');
            expect(dtos[0].url).toEqual('https://x/one.pdf');
            expect(dtos[0].size).toEqual(10);
            expect(dtos[1].url).toEqual('https://x/two.pdf');
            expect(dtos[1].size).toEqual(20);
            dtos.forEach((dto) => {
                expect(dto.id).toMatch(UUID_V4_REGEX);
                expect(dto.created_at).toEqual('2026-01-02T00:00:00.000Z');
                expect(dto.created_by).toEqual('user-1');
                expect(dto.updated_at).toBeNull();
                expect(dto.updated_by).toBeNull();
                expect(dto.deleted_at).toBeNull();
                expect(dto.deleted_by).toBeNull();
            });
        });

        it('defaults url/size to null when an individual attachment omits them', () => {
            const dtos = WebhookMapper.toAttachmentDTOs({ attachments: [{}] }, 'email-1');

            expect(dtos[0].url).toBeNull();
            expect(dtos[0].size).toBeNull();
        });

        it('defaults created_at/created_by when absent from a payload that does have attachments', () => {
            jest.useFakeTimers().setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

            const dtos = WebhookMapper.toAttachmentDTOs({ attachments: [{ url: 'u', size: 1 }] }, 'email-1');

            expect(dtos[0].created_at).toEqual(new Date('2026-03-15T10:00:00.000Z'));
            expect(dtos[0].created_by).toBeNull();
        });
    });
});
