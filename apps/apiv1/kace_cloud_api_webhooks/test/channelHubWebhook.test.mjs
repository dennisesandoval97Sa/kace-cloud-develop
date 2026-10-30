import { jest } from '@jest/globals';
import { channelHubSchema } from '../src/schemas.mjs';
import { Controller } from '../src/controller.mjs';

const minimalPayload = {
    messageId: 'channel-hub-external-message-id-that-is-not-a-uuid',
    origin: 'customer@example.com',
    connectionId: 'conn_support',
    tag: 'rg',
    destination: {
        to: [],
        cc: [],
        bcc: [{ email: 'SUPPORT@EXAMPLE.COM', name: 'Support' }],
    },
    content: {
        text: 'https://channel-hub-cdn.example.com/messages/msg-1.txt',
    },
};

function eventFor(payload) {
    return {
        resource: '/channel-hub',
        body: JSON.stringify(payload),
        headers: {},
        tenant: {
            apps_debug: { value: 'true' },
        },
        kContext: {
            awsRequestId: 'test-request-id',
        },
    };
}

function responseBody(response) {
    return JSON.parse(response.toJson().body);
}

describe('Channel Hub webhook adapter', () => {
    it('accepts the minimal BCC payload schema', () => {
        const { error, value } = channelHubSchema.validate(minimalPayload, { abortEarly: false });

        expect(error).toBeUndefined();
        expect(value.destination.bcc).toEqual([{ email: 'SUPPORT@EXAMPLE.COM', name: 'Support' }]);
    });

    it('requires Channel Hub connectionId for inbound routing', () => {
        const { connectionId, ...payload } = minimalPayload;

        const { error } = channelHubSchema.validate(payload, { abortEarly: false });

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('connectionId');
    });

    it('rejects blank Channel Hub connectionId for inbound routing', () => {
        const { error } = channelHubSchema.validate({ ...minimalPayload, connectionId: '   ' }, { abortEarly: false });

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('connectionId');
    });

    it('accepts payloads without tag so the processor can route them to INBOX', () => {
        const { tag, ...payload } = minimalPayload;

        const { error, value } = channelHubSchema.validate(payload, { abortEarly: false });

        expect(error).toBeUndefined();
        expect(value.tag).toBeUndefined();
    });

    it.each([
        ['blank', ''],
        ['null', null],
    ])('accepts payloads with %s tag so the processor can route them to INBOX', (_name, tag) => {
        const { error, value } = channelHubSchema.validate({ ...minimalPayload, tag }, { abortEarly: false });

        expect(error).toBeUndefined();
        expect(value.tag).toBe(tag);
    });

    it('accepts Channel Hub payloads with empty optional cc and bcc strings', () => {
        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination: {
                    to: 'juan.zapata@konecta.com',
                    cc: '',
                    bcc: '',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.destination.cc).toBe('');
        expect(value.destination.bcc).toBe('');
    });

    it('accepts the BCC-only recipient shape emitted by Channel Hub', () => {
        const destination = {
            to: '',
            cc: '',
            bcc: 'support@example.com',
        };

        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination,
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.destination).toEqual(destination);
    });

    it.each([
        ['whitespace', ' '],
        ['null', null],
    ])('rejects %s recipient values while another recipient is valid', (_label, invalidRecipient) => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination: {
                    to: invalidRecipient,
                    cc: '',
                    bcc: 'support@example.com',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: ['destination', 'to'],
                }),
            ])
        );
    });

    it.each([
        {
            label: 'empty strings',
            destination: { to: '', cc: '', bcc: '' },
            expectedDetail: {
                path: ['destination'],
                type: 'object.nonEmptyRecipient',
                message: '"destination" must contain at least one non-empty recipient',
            },
        },
        {
            label: 'empty arrays',
            destination: { to: [], cc: [], bcc: [] },
            expectedDetail: {
                path: ['destination'],
                type: 'object.nonEmptyRecipient',
            },
        },
    ])('rejects a destination whose recipient fields are all $label', ({ destination, expectedDetail }) => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination,
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details).toEqual(expect.arrayContaining([expect.objectContaining(expectedDetail)]));
    });

    it('accepts Channel Hub payloads with comma-separated recipient strings', () => {
        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination: {
                    to: 'juan.zapata@konecta.com, soporte@konecta.com',
                    cc: 'juanfernet007@gmail.com, juanfernet007@hotmail.com, juanfernet007@yahoo.es',
                    bcc: '',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.destination.to).toBe('juan.zapata@konecta.com, soporte@konecta.com');
        expect(value.destination.cc).toBe('juanfernet007@gmail.com, juanfernet007@hotmail.com, juanfernet007@yahoo.es');
        expect(value.destination.bcc).toBe('');
    });

    it('rejects comma-separated recipient strings containing invalid emails', () => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                destination: {
                    to: 'juan.zapata@konecta.com',
                    cc: 'valid@example.com, not-an-email',
                    bcc: '',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('destination.cc');
    });

    it('accepts an optional Channel Hub HTML body URL', () => {
        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                content: {
                    ...minimalPayload.content,
                    html: 'https://channel-hub-cdn.example.com/messages/msg-1.html',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.content.html).toBe('https://channel-hub-cdn.example.com/messages/msg-1.html');
    });

    it('rejects non-URI Channel Hub HTML body values', () => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                content: {
                    ...minimalPayload.content,
                    html: 'not-a-url',
                },
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('content.html');
    });

    it('accepts optional Channel Hub attachments with filename aliases', () => {
        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                attachments: [
                    {
                        url: 'https://channel-hub-cdn.example.com/attachments/invoice.pdf',
                        filename: 'invoice.pdf',
                        name: 'legacy-invoice.pdf',
                        fileName: 'camel-invoice.pdf',
                        content_type: 'application/pdf',
                        contentType: 'application/pdf',
                        size: 12,
                    },
                ],
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.attachments[0].filename).toBe('invoice.pdf');
    });

    it('accepts Channel Hub attachments sent as URL strings and normalizes them to objects', () => {
        const attachmentUrl = 'https://channel-hub-cdn.example.com/attachments/invoice.pdf';
        const { error, value } = channelHubSchema.validate(
            {
                ...minimalPayload,
                attachments: [attachmentUrl],
            },
            { abortEarly: false }
        );

        expect(error).toBeUndefined();
        expect(value.attachments).toEqual([{ url: attachmentUrl }]);
    });

    it('rejects non-URI Channel Hub attachment URLs', () => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                attachments: [{ url: 'not-a-url', filename: 'invoice.pdf' }],
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('attachments.0.url');
    });

    it('rejects non-URI Channel Hub attachment URL strings', () => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                attachments: ['not-a-url'],
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('attachments.0');
    });

    it('rejects payloads missing messageId', () => {
        const { messageId, ...payload } = minimalPayload;

        const { error } = channelHubSchema.validate(payload, { abortEarly: false });

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('messageId');
    });

    it('rejects payloads with messageIdOperator but no messageId', () => {
        const { messageId, ...payload } = minimalPayload;

        const { error } = channelHubSchema.validate(
            { ...payload, messageIdOperator: 'operator-message-id' },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain('messageId');
    });

    it.each([
        ['overlong messageId', { messageId: 'm'.repeat(256) }, 'messageId'],
        [
            'overlong messageIdOperator',
            { messageId: undefined, messageIdOperator: 'm'.repeat(256) },
            'messageIdOperator',
        ],
        ['overlong origin', { origin: `${'a'.repeat(120)}@example.com` }, 'origin'],
        ['overlong subject', { subject: 's'.repeat(501) }, 'subject'],
        ['overlong connectionId', { connectionId: 'c'.repeat(256) }, 'connectionId'],
        ['overlong threadId', { threadId: 't'.repeat(256) }, 'threadId'],
        ['overlong tag', { tag: 't'.repeat(51) }, 'tag'],
    ])('rejects DB-bound overlong fields: %s', (_name, override, expectedPath) => {
        const { error } = channelHubSchema.validate(
            {
                ...minimalPayload,
                ...override,
            },
            { abortEarly: false }
        );

        expect(error).toBeDefined();
        expect(error.details.map((detail) => detail.path.join('.'))).toContain(expectedPath);
    });

    it('delegates validated Channel Hub payload to the core processor', async () => {
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const processorFactory = jest.fn(() => processor);
        const controller = new Controller(eventFor(minimalPayload), {}, { processorFactory });

        const response = await controller.handle();

        expect(processorFactory).toHaveBeenCalledTimes(1);
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(minimalPayload));
        expect(response.toJson().statusCode).toBe(200);
    });

    it('delegates the BCC-only Channel Hub wire shape without changing its recipient representation', async () => {
        const destination = {
            to: '',
            cc: '',
            bcc: 'support@example.com',
        };
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                destination,
            }),
            {},
            { processorFactory: () => processor }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining({ destination }));
    });

    it('delegates Channel Hub payloads with string attachment URLs after validation normalization', async () => {
        const attachmentUrl = 'https://channel-hub-cdn.example.com/attachments/invoice.pdf';
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                attachments: [attachmentUrl],
            }),
            {},
            { processorFactory: () => processor }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(processor.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                attachments: [{ url: attachmentUrl }],
            })
        );
    });

    it('destroys lifecycle-managed processor resources after handling public webhooks', async () => {
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const destroy = jest.fn().mockResolvedValue();
        const controller = new Controller(
            eventFor(minimalPayload),
            {},
            {
                processorFactory: () => ({ processor, destroy }),
            }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('maps an accepted processor result to HTTP 200', async () => {
        const response = await controllerResponseFor({
            accepted: true,
            nonRetryable: false,
            retryable: false,
            status: 'accepted',
            code: 'accepted',
            data: { email_id: 'email-id' },
        });

        expect(response.toJson().statusCode).toBe(200);
        expect(responseBody(response).data).toEqual({ email_id: 'email-id' });
    });

    it('maps an already-processed replay result to HTTP 200 with replay data', async () => {
        const response = await controllerResponseFor({
            accepted: true,
            alreadyProcessed: true,
            nonRetryable: false,
            retryable: false,
            status: 'accepted',
            code: 'already_processed',
            message: 'Channel Hub message was already processed.',
            data: { already_processed: true, email_id: 'email-id', interaction_id: 'interaction-id' },
        });

        expect(response.toJson().statusCode).toBe(200);
        expect(responseBody(response).data).toEqual({
            already_processed: true,
            email_id: 'email-id',
            interaction_id: 'interaction-id',
        });
    });

    it('maps a non-retryable processor result to HTTP 400', async () => {
        const response = await controllerResponseFor({
            accepted: false,
            nonRetryable: true,
            retryable: false,
            status: 'non_retryable',
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });

        expect(response.toJson().statusCode).toBe(400);
        expect(responseBody(response).errors).toEqual({
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });
    });

    it('returns a safe SUBJECT_FORBIDDEN_WORD description without exposing the rejected subject', async () => {
        const subject = 'Delivery Status Notification (Delay)';
        const response = await controllerResponseFor({
            accepted: false,
            nonRetryable: true,
            retryable: false,
            status: 'non_retryable',
            code: 'SUBJECT_FORBIDDEN_WORD',
            message: `Palabras prohibidas detectadas en subject - delay: ${subject}`,
        });
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('SUBJECT_FORBIDDEN_WORD');
        expect(body.message).toBe('Subject contains a forbidden word · SUBJECT_FORBIDDEN_WORD');
        expect(body.message).not.toContain(subject);
        expect(body.errors).toEqual([
            {
                code: 'SUBJECT_FORBIDDEN_WORD',
                message: 'Subject contains a forbidden word · SUBJECT_FORBIDDEN_WORD',
            },
        ]);
    });

    it('returns BODY_TOO_LARGE with the configured and received plain-text body sizes', async () => {
        const receivedBytes = 15469051;
        const response = await controllerResponseFor({
            accepted: false,
            nonRetryable: true,
            retryable: false,
            status: 'non_retryable',
            code: 'text_body_too_large',
            message: `Plain-text body exceeds 10485760 bytes (received ${receivedBytes})`,
        });
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('BODY_TOO_LARGE');
        expect(body.message).toBe(
            `Plain-text body exceeds 10485760 bytes (received ${receivedBytes}) · BODY_TOO_LARGE`
        );
    });

    it('maps an oversized HTML body to BODY_TOO_LARGE', async () => {
        const response = await controllerResponseFor({
            accepted: false,
            nonRetryable: true,
            retryable: false,
            status: 'non_retryable',
            code: 'html_body_too_large',
            message: 'HTML body exceeds 10485760 bytes (received 15469051)',
        });
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('BODY_TOO_LARGE');
        expect(body.message).toBe('HTML body exceeds 10485760 bytes (received 15469051) · BODY_TOO_LARGE');
    });

    it('returns ATTACHMENT_ENCRYPTED as HTTP 422 for an encrypted PDF', async () => {
        const filename = '08FalloTutela2026-0925-ConcedePeticion.pdf';
        const response = await controllerResponseFor({
            accepted: false,
            nonRetryable: true,
            retryable: false,
            status: 'non_retryable',
            code: 'attachment_encrypted',
            message: `Attachment cannot be scanned: encrypted PDF '${filename}'`,
        });
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(422);
        expect(body.code).toBe('ATTACHMENT_ENCRYPTED');
        expect(body.message).toBe(`Attachment cannot be scanned: encrypted PDF '${filename}' · ATTACHMENT_ENCRYPTED`);
    });

    it('logs processor results before mapping non-retryable results to HTTP 400', async () => {
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: false,
                nonRetryable: true,
                retryable: false,
                status: 'non_retryable',
                code: 'channel_hub_connection_not_found',
                message:
                    "Channel Hub connectionId 'conn_support' does not match a configured Channel Hub Account in KACE.",
            }),
        };
        const logger = { logDebug: jest.fn() };
        const controller = new Controller(eventFor(minimalPayload), {}, { logger, processorFactory: () => processor });

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(400);
        expect(logger.logDebug).toHaveBeenCalledWith('ChannelHubWebhook::processingResult', {
            resource: '/channel-hub',
            requestId: 'test-request-id',
            duration: expect.any(Number),
            result: expect.objectContaining({
                status: 'non_retryable',
                code: 'channel_hub_connection_not_found',
                message:
                    "Channel Hub connectionId 'conn_support' does not match a configured Channel Hub Account in KACE.",
                nonRetryable: true,
            }),
        });
    });

    it('maps a retryable processor result to HTTP 500', async () => {
        // The 500 branch is not marked exposePublicErrorDetails, so its detail only
        // surfaces when the debug chain (APPS_DEBUG > APPS_DEBUG_OVERRIDE > tenant) is on.
        const originalAppsDebug = process.env.APPS_DEBUG;
        process.env.APPS_DEBUG = 'true';

        try {
            const response = await controllerResponseFor({
                accepted: false,
                nonRetryable: false,
                retryable: true,
                status: 'retryable',
                code: 'processing_failed',
                message: 'Temporary failure.',
            });

            expect(response.toJson().statusCode).toBe(500);
            expect(responseBody(response).errors).toEqual({
                code: 'processing_failed',
                message: 'Temporary failure.',
            });
        } finally {
            if (originalAppsDebug === undefined) {
                delete process.env.APPS_DEBUG;
            } else {
                process.env.APPS_DEBUG = originalAppsDebug;
            }
        }
    });

    it('returns HTTP 400 for malformed JSON payloads', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            { ...eventFor(minimalPayload), body: '{bad-json' },
            {},
            {
                processorFactory: () => processor,
            }
        );

        try {
            const response = await controller.handle();
            const body = responseBody(response);

            expect(response.toJson().statusCode).toBe(400);
            expect(body.message).toBe('Invalid JSON payload');
            expect(body.errors.code).toBe('invalid_json_payload');
            expect(processor.execute).not.toHaveBeenCalled();
        } finally {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it.each([600, 972, 992])(
        'returns SUBJECT_TOO_LONG with the limit and received length for a %i-character subject',
        async (receivedLength) => {
            const processor = { execute: jest.fn() };
            const controller = new Controller(
                eventFor({
                    ...minimalPayload,
                    subject: 's'.repeat(receivedLength),
                }),
                {},
                { processorFactory: () => processor }
            );

            const response = await controller.handle();
            const body = responseBody(response);

            expect(response.toJson().statusCode).toBe(400);
            expect(body.code).toBe('SUBJECT_TOO_LONG');
            expect(body.message).toBe(`Subject exceeds 500 characters (received ${receivedLength}) · SUBJECT_TOO_LONG`);
            expect(processor.execute).not.toHaveBeenCalled();
        }
    );

    it('returns RECIPIENT_INVALID with the malformed destination address', async () => {
        const recipient = 'natura.co@latamcf.-natura.com';
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                destination: {
                    to: recipient,
                    cc: '',
                    bcc: '',
                },
            }),
            {},
            { processorFactory: () => processor }
        );

        const response = await controller.handle();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('RECIPIENT_INVALID');
        expect(body.message).toBe(`Invalid recipient address: '${recipient}' · RECIPIENT_INVALID`);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('reports the exact invalid address from an object recipient', async () => {
        const recipient = 'invalid-address';
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                destination: {
                    to: [{ email: 'valid@example.com' }, { email: recipient, name: 'Invalid' }],
                    cc: '',
                    bcc: '',
                },
            }),
            {},
            { processorFactory: () => processor }
        );

        const response = await controller.handle();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.message).toBe(`Invalid recipient address: '${recipient}' · RECIPIENT_INVALID`);
        expect(body.message).not.toContain('[object Object]');
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('caps a reflected invalid recipient address', async () => {
        const recipient = `${'x'.repeat(200)}@example.com`;
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                destination: { to: recipient, cc: '', bcc: '' },
            }),
            {},
            { processorFactory: () => processor }
        );

        const response = await controller.handle();
        const body = responseBody(response);
        const reflectedAddress = body.message.match(/'([^']*)'/)?.[1];

        expect(response.toJson().statusCode).toBe(400);
        expect(reflectedAddress).toHaveLength(120);
        expect(body.message).not.toContain(recipient);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it.each(['IMCEAEX-_O=FIRST+20.@prod.exchangelabs.com', 'IMCEAEX-legacy@example.com'])(
        'returns SENDER_INVALID for the Exchange X.500 sender %s',
        async (sender) => {
            const processor = { execute: jest.fn() };
            const controller = new Controller(
                eventFor({
                    ...minimalPayload,
                    origin: sender,
                }),
                {},
                { processorFactory: () => processor }
            );

            const response = await controller.handle();
            const body = responseBody(response);

            expect(response.toJson().statusCode).toBe(400);
            expect(body.code).toBe('SENDER_INVALID');
            expect(body.message).toBe(`Invalid sender address format (non-SMTP/X.500): '${sender}' · SENDER_INVALID`);
            expect(processor.execute).not.toHaveBeenCalled();
        }
    );

    it('returns HTTP 400 for invalid Channel Hub payloads before calling the processor', async () => {
        const { messageId, ...payload } = minimalPayload;
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            eventFor(payload),
            {},
            {
                processorFactory: () => processor,
            }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(400);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 for an all-empty destination before calling the processor', async () => {
        const processor = { execute: jest.fn() };
        const controller = new Controller(
            eventFor({
                ...minimalPayload,
                destination: {
                    to: '',
                    cc: '',
                    bcc: '',
                },
            }),
            {},
            {
                processorFactory: () => processor,
            }
        );

        const response = await controller.handle();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('RECIPIENT_INVALID');
        expect(body.message).toBe('Destination must contain at least one recipient · RECIPIENT_INVALID');
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('uses the standard validation response when the required origin is missing', async () => {
        const { origin: _origin, ...payload } = minimalPayload;
        const processor = { execute: jest.fn() };
        const controller = new Controller(eventFor(payload), {}, { processorFactory: () => processor });

        const response = await controller.handle();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).not.toBe('SENDER_INVALID');
        expect(body.message).not.toContain('undefined');
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('logs the parsed Channel Hub webhook payload before validation', async () => {
        const { tag, ...payload } = minimalPayload;
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const logger = { logDebug: jest.fn() };
        const controller = new Controller(
            eventFor(payload),
            {},
            {
                logger,
                processorFactory: () => processor,
            }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(logger.logDebug).toHaveBeenCalledWith('ChannelHubWebhook::receivedPayload', {
            resource: '/channel-hub',
            requestId: 'test-request-id',
            payload,
        });
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(payload));
    });

    it('delegates missing Channel Hub tag payloads to the processor for INBOX fallback', async () => {
        const { tag, ...payload } = minimalPayload;
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const controller = new Controller(
            eventFor(payload),
            {},
            {
                processorFactory: () => processor,
            }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(payload));
    });

    it('ignores legacy tags as a routing field and delegates the payload without tag', async () => {
        const { tag, ...payloadWithoutTag } = minimalPayload;
        const payload = {
            ...payloadWithoutTag,
            tags: 'workspace-id-should-not-be-accepted',
        };
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                nonRetryable: false,
                retryable: false,
                status: 'accepted',
                code: 'accepted',
                data: { email_id: 'email-id' },
            }),
        };
        const controller = new Controller(
            eventFor(payload),
            {},
            {
                processorFactory: () => processor,
            }
        );

        const response = await controller.handle();

        expect(response.toJson().statusCode).toBe(200);
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(payload));
    });
});

async function controllerResponseFor(result) {
    const processor = {
        execute: jest.fn().mockResolvedValue(result),
    };
    const controller = new Controller(eventFor(minimalPayload), {}, { processorFactory: () => processor });

    return controller.handle();
}
