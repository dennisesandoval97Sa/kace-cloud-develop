import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';

const renderRecipientList = jest.fn((field, value) => value ?? []);

jest.unstable_mockModule('../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js', () => ({
    buildEmailTemplateContext: jest.fn().mockResolvedValue({}),
    replaceTemplateVariables: jest.fn((text) => text),
    renderRecipientList,
    parseEmailList: jest.fn((v) => v),
    renderEmailsOrFail: jest.fn((field, value) => value ?? []),
}));

const { CHANNEL_HUB_SEND_REJECTED } = await import('@kace/error-codes');
const { EmailSender } = await import('../../src/emails/application/send/EmailSender.js');
const { InvalidArgumentError } = await import('../../src/shared/errors/InvalidArgumentError.js');

function buildDeps(overrides = {}) {
    return {
        emailRepository: { save: jest.fn().mockResolvedValue(undefined) },
        emailBodyRepository: { save: jest.fn().mockResolvedValue(undefined) },
        channelHubAccountRepository: {
            findByEmail: jest.fn().mockResolvedValue({
                id: { value: uuidV4() },
                channel_hub_connection_id: { value: 'conn-1' },
            }),
        },
        interactionRepository: { find: jest.fn().mockResolvedValue({ workspace_id: { value: uuidV4() } }) },
        caseRepository: { find: jest.fn().mockResolvedValue({ id: { value: uuidV4() }, reference: { value: 1 } }) },
        workspaceRepository: {
            findDefaultInboxWorkspace: jest.fn().mockResolvedValue({ id: { value: uuidV4() } }),
        },
        workflowExecutor: {
            execute: jest.fn().mockResolvedValue({
                toJson: () => ({ data: { context: { channel_hub: { send_response: { messageId: 'msg-1' } } } } }),
            }),
        },
        attachmentPersister: {
            prepare: jest.fn().mockResolvedValue([]),
            persist: jest.fn().mockResolvedValue(undefined),
        },
        clientFinder: {},
        userFinder: {},
        classificationFinder: {},
        auxCasesFinder: {},
        auxClientsFinder: {},
        ...overrides,
    };
}

function dto(overrides = {}) {
    return {
        case_id: uuidV4(),
        interaction_id: uuidV4(),
        from: 'a@b.com',
        to: ['c@d.com'],
        subject: 's',
        message_to_send: 'm',
        attachments: [],
        ...overrides,
    };
}

describe('EmailSender', () => {
    beforeEach(() => {
        renderRecipientList.mockReset();
        renderRecipientList.mockImplementation((field, value) => value ?? []);
    });

    it('rejects when the case referenced by case_id does not exist', async () => {
        const deps = buildDeps({ caseRepository: { find: jest.fn().mockResolvedValue(null) } });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Case not found for this case_id',
            statusCode: 422,
        });
        expect(deps.channelHubAccountRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('rejects when no Channel Hub account is registered for the from address', async () => {
        const deps = buildDeps({ channelHubAccountRepository: { findByEmail: jest.fn().mockResolvedValue(null) } });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'No Channel Hub account found for this from address',
            statusCode: 422,
        });
    });

    it('re-throws recipient rendering errors that are not InvalidArgumentError as-is', async () => {
        const deps = buildDeps();
        const unexpectedError = new Error('boom');
        renderRecipientList.mockImplementation(() => {
            throw unexpectedError;
        });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toBe(unexpectedError);
        expect(deps.workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('maps recipient rendering InvalidArgumentError into a 422 CustomError', async () => {
        const deps = buildDeps();
        renderRecipientList.mockImplementation(() => {
            throw new InvalidArgumentError('to has unresolved variables');
        });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'to has unresolved variables',
            statusCode: 422,
        });
    });

    it('surfaces the Channel Hub problem+json detail with its public error code', async () => {
        // Channel Hub responde el rechazo por HTTP y `AxiosHttpClient` no lanza: el
        // problem+json llega al contexto del flujo como una respuesta más.
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub: {
                            send_response: {
                                type: 'urn:problem:bad-request',
                                title: 'Bad Request',
                                detail: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
                                status: 400,
                                instance: '/tst/v1/channel/email',
                            },
                        },
                    },
                },
            }),
        });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
            statusCode: 400,
            publicErrorCode: CHANNEL_HUB_SEND_REJECTED,
        });
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });

    it('keeps a Channel Hub 5xx as an upstream 502 instead of blaming the client', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub: {
                            send_response: {
                                type: 'urn:problem:internal-server-error',
                                title: 'Internal Server Error',
                                detail: 'Upstream mail provider unavailable',
                                status: 503,
                                instance: '/tst/v1/channel/email',
                            },
                        },
                    },
                },
            }),
        });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub rejected the send',
            statusCode: 502,
        });
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });

    it('falls back to the error message, then a generic message, when Channel Hub failures carry no detail', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockRejectedValueOnce(new Error('network timeout'));
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'network timeout',
            statusCode: 400,
        });

        deps.workflowExecutor.execute.mockRejectedValueOnce({});
        await expect(sender.execute(dto({ case_id: uuidV4() }), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub request failed',
            statusCode: 400,
        });
    });

    it('rejects when Channel Hub accepts the send but returns no message id', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({ data: { context: { channel_hub: { send_response: {} } } } }),
        });
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub rejected the send',
            statusCode: 502,
        });
    });

    it('defaults attachments to an empty list and case reference to null when the DTO/case omit them', async () => {
        const deps = buildDeps({
            caseRepository: { find: jest.fn().mockResolvedValue({ id: { value: uuidV4() } }) },
        });
        const sender = new EmailSender(deps);
        const dtoWithoutAttachments = dto();
        delete dtoWithoutAttachments.attachments;

        const result = await sender.execute(dtoWithoutAttachments, uuidV4());

        expect(deps.attachmentPersister.prepare).toHaveBeenCalledWith([]);
        expect(deps.emailRepository.save.mock.calls[0][0].case_reference_outbound.value).toBeNull();
        expect(result.id).toEqual(expect.any(String));
    });
});
