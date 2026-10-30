import { jest } from '@jest/globals';
import { ControllerWebhook } from '../src/ControllerWebhook.mjs';
import { User } from '@kace/core/src/users/index.js';

const minimalPayload = {
    messageId: 'channel-hub-message-id',
    origin: 'customer@example.com',
    connectionId: 'conn_support',
    tag: 'rg',
    destination: {
        bcc: [{ email: 'support@example.com', name: 'Support' }],
    },
    content: {
        text: 'https://channel-hub-cdn.example.com/messages/msg-1.txt',
    },
};

function tenant() {
    return {
        apps_debug: { value: 'true' },
        aws_cognito_user_pool_id: { value: 'us-east-1_localpool' },
        aws_cognito_app_client_id: { value: 'local-client' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_sqs_events_queue_url: { value: 'https://sqs.example/queue.fifo' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'local-bus' },
    };
}

function eventFor(payload, overrides = {}) {
    const t = tenant();

    return {
        resource: '/',
        httpMethod: 'POST',
        path: '/webhook',
        body: JSON.stringify(payload),
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
        ...overrides,
    };
}

function authorizedUser() {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'id', {
        value: { value: 'authorized-user-id' },
    });
    Object.defineProperty(user, 'hasPermission', {
        value: jest.fn(() => true),
    });

    return user;
}

function unauthorizedUser() {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'hasPermission', {
        value: jest.fn(() => false),
    });

    return user;
}

function responseBody(response) {
    return JSON.parse(response.toJson().body);
}

function knexConfig() {
    return {
        client: 'sqlite3',
        connection: {
            filename: ':memory:',
        },
        useNullAsDefault: true,
    };
}

function controllerFor(resultOrProcessor, event = eventFor(minimalPayload)) {
    let processorResource = resultOrProcessor;
    if (!resultOrProcessor.processor && !resultOrProcessor.execute) {
        processorResource = { execute: jest.fn().mockResolvedValue(resultOrProcessor) };
    }
    const processor = processorResource.processor ?? processorResource;
    const processorFactoryResult = resultOrProcessor.processor ? processorResource : processor;
    const controller = new ControllerWebhook(event, knexConfig(), { processorFactory: () => processorFactoryResult });
    controller.user = authorizedUser();

    return { controller, processor };
}

describe('legacy interactions Channel Hub webhook adapter', () => {
    // The retryable 500 branch only carries its detail with debug on
    // (APPS_DEBUG > APPS_DEBUG_OVERRIDE > tenant).
    const originalAppsDebug = process.env.APPS_DEBUG;

    beforeAll(() => {
        process.env.APPS_DEBUG = 'true';
    });

    afterAll(() => {
        if (originalAppsDebug === undefined) {
            delete process.env.APPS_DEBUG;
        } else {
            process.env.APPS_DEBUG = originalAppsDebug;
        }
    });

    it('delegates validated Channel Hub payload to the canonical processor', async () => {
        const { controller, processor } = controllerFor({
            accepted: true,
            data: { email_id: 'email-id' },
        });

        const response = await controller.actionCreate();

        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(minimalPayload));
        expect(response.toJson().statusCode).toBe(200);
        expect(responseBody(response).data).toEqual({ email_id: 'email-id' });
    });

    it('delegates the BCC-only Channel Hub wire shape to the canonical processor', async () => {
        const destination = {
            to: '',
            cc: '',
            bcc: 'support@example.com',
        };
        const payload = {
            ...minimalPayload,
            destination,
        };
        const { controller, processor } = controllerFor(
            {
                accepted: true,
                data: { email_id: 'email-id' },
            },
            eventFor(payload)
        );

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(200);
        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining({ destination }));
    });

    it('maps non-retryable processor results like the public Channel Hub webhook', async () => {
        const { controller } = controllerFor({
            accepted: false,
            nonRetryable: true,
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(responseBody(response).errors).toEqual({
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });
    });

    it('maps retryable processor results like the public Channel Hub webhook', async () => {
        const { controller } = controllerFor({
            accepted: false,
            retryable: true,
            code: 'processing_failed',
            message: 'Temporary failure.',
        });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(500);
        expect(responseBody(response).errors).toEqual({
            code: 'processing_failed',
            message: 'Temporary failure.',
        });
    });

    it('destroys lifecycle-managed processor resources after delegation', async () => {
        const processor = {
            execute: jest.fn().mockResolvedValue({
                accepted: true,
                data: { email_id: 'email-id' },
            }),
        };
        const destroy = jest.fn().mockResolvedValue();
        const { controller } = controllerFor({ processor, destroy });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(200);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid Channel Hub payloads before calling the processor', async () => {
        const { messageId, ...invalidPayload } = minimalPayload;
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor, eventFor(invalidPayload));

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('returns the shared SUBJECT_TOO_LONG description before calling the processor', async () => {
        const processor = { execute: jest.fn() };
        const payload = {
            ...minimalPayload,
            subject: 's'.repeat(992),
        };
        const { controller } = controllerFor(processor, eventFor(payload));

        const response = await controller.actionCreate();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe('SUBJECT_TOO_LONG');
        expect(body.message).toBe('Subject exceeds 500 characters (received 992) · SUBJECT_TOO_LONG');
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it.each([
        {
            name: 'malformed recipient',
            payload: {
                ...minimalPayload,
                destination: { to: 'natura.co@latamcf.-natura.com', cc: '', bcc: '' },
            },
            code: 'RECIPIENT_INVALID',
            message: "Invalid recipient address: 'natura.co@latamcf.-natura.com' · RECIPIENT_INVALID",
        },
        {
            name: 'Exchange X.500 sender',
            payload: {
                ...minimalPayload,
                origin: 'IMCEAEX-_O=FIRST+20.@prod.exchangelabs.com',
            },
            code: 'SENDER_INVALID',
            message:
                "Invalid sender address format (non-SMTP/X.500): 'IMCEAEX-_O=FIRST+20.@prod.exchangelabs.com' · SENDER_INVALID",
        },
    ])('returns the shared $code description for $name', async ({ payload, code, message }) => {
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor, eventFor(payload));

        const response = await controller.actionCreate();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(400);
        expect(body.code).toBe(code);
        expect(body.message).toBe(message);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it.each([
        {
            name: 'Gmail delay subject',
            result: {
                accepted: false,
                nonRetryable: true,
                code: 'SUBJECT_FORBIDDEN_WORD',
                message: 'Palabras prohibidas detectadas en subject - delay: Delivery Status Notification (Delay)',
            },
            statusCode: 400,
            code: 'SUBJECT_FORBIDDEN_WORD',
            message: 'Subject contains a forbidden word · SUBJECT_FORBIDDEN_WORD',
        },
        {
            name: 'oversized plain-text body',
            result: {
                accepted: false,
                nonRetryable: true,
                code: 'text_body_too_large',
                message: 'Plain-text body exceeds 10485760 bytes (received 15469051)',
            },
            statusCode: 400,
            code: 'BODY_TOO_LARGE',
            message: 'Plain-text body exceeds 10485760 bytes (received 15469051) · BODY_TOO_LARGE',
        },
        {
            name: 'oversized HTML body',
            result: {
                accepted: false,
                nonRetryable: true,
                code: 'html_body_too_large',
                message: 'HTML body exceeds 10485760 bytes (received 15469051)',
            },
            statusCode: 400,
            code: 'BODY_TOO_LARGE',
            message: 'HTML body exceeds 10485760 bytes (received 15469051) · BODY_TOO_LARGE',
        },
        {
            name: 'encrypted PDF attachment',
            result: {
                accepted: false,
                nonRetryable: true,
                code: 'attachment_encrypted',
                message: "Attachment cannot be scanned: encrypted PDF 'encrypted.pdf'",
            },
            statusCode: 422,
            code: 'ATTACHMENT_ENCRYPTED',
            message: "Attachment cannot be scanned: encrypted PDF 'encrypted.pdf' · ATTACHMENT_ENCRYPTED",
        },
    ])('maps the shared $code response for $name', async ({ result, statusCode, code, message }) => {
        const { controller } = controllerFor(result);

        const response = await controller.actionCreate();
        const body = responseBody(response);

        expect(response.toJson().statusCode).toBe(statusCode);
        expect(body.code).toBe(code);
        expect(body.message).toBe(message);
    });

    it('returns HTTP 400 for malformed JSON before calling the processor', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor, eventFor(minimalPayload, { body: '{bad-json' }));

        try {
            const response = await controller.actionCreate();
            const body = responseBody(response);

            expect(response.toJson().statusCode).toBe(400);
            expect(body.message).toBe('Invalid JSON payload');
            expect(body.errors.code).toBe('invalid_json_payload');
            expect(processor.execute).not.toHaveBeenCalled();
        } finally {
            process.env.NODE_ENV = originalNodeEnv;
        }
    });

    it('preserves legacy permission checks before calling the processor', async () => {
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor);
        controller.user = unauthorizedUser();

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(403);
        expect(processor.execute).not.toHaveBeenCalled();
    });
});
