import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';

const renderRecipientList = jest.fn((field, value) => value ?? []);

jest.unstable_mockModule('../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js', () => ({
    buildEmailTemplateContext: jest.fn().mockResolvedValue({}),
    replaceTemplateVariables: jest.fn((text) => text),
    renderRecipientList,
    parseEmailList: jest.fn((value) => value ?? []),
    renderEmailsOrFail: jest.fn((field, value) => value ?? []),
}));

const { CHANNEL_HUB_REPLY_REJECTED } = await import('@kace/error-codes');
const { EmailReplier } = await import('../../src/emails/application/reply/EmailReplier.js');
const { CustomError } = await import('../../src/shared/errors/CustomError.js');
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
        workflowExecutor: {
            execute: jest.fn().mockResolvedValue({
                toJson: () => ({
                    data: {
                        context: {
                            channel_hub: {
                                reply_response: { messageId: 'msg-1', threadId: 't-1', subject: 's', destination: {} },
                            },
                        },
                    },
                }),
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
        in_reply_to: 'orig-msg-id',
        reply_message_to_send: 'm',
        is_reply_all: false,
        attachments: [],
        ...overrides,
    };
}

describe('EmailReplier', () => {
    beforeEach(() => {
        renderRecipientList.mockReset();
        renderRecipientList.mockImplementation((field, value) => value ?? []);
    });

    it('rejects when the case referenced by case_id does not exist', async () => {
        const deps = buildDeps({ caseRepository: { find: jest.fn().mockResolvedValue(null) } });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Case not found for this case_id',
            statusCode: 422,
        });
        expect(deps.channelHubAccountRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('defaults attachments to an empty list when the DTO omits the field entirely', async () => {
        const deps = buildDeps();
        const replier = new EmailReplier(deps);
        const dtoWithoutAttachments = dto();
        delete dtoWithoutAttachments.attachments;

        await replier.execute(dtoWithoutAttachments, uuidV4());

        expect(deps.attachmentPersister.prepare).toHaveBeenCalledWith([]);
        expect(deps.attachmentPersister.persist).toHaveBeenCalledWith(expect.objectContaining({ attachments: [] }));
    });

    it('rejects when no Channel Hub account is registered for the from address', async () => {
        const deps = buildDeps({ channelHubAccountRepository: { findByEmail: jest.fn().mockResolvedValue(null) } });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
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
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toBe(unexpectedError);
        expect(deps.workflowExecutor.execute).not.toHaveBeenCalled();
    });

    it('maps recipient rendering InvalidArgumentError into a 422 CustomError', async () => {
        const deps = buildDeps();
        renderRecipientList.mockImplementation(() => {
            throw new InvalidArgumentError('cc has unresolved variables');
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'cc has unresolved variables',
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
                            reply_response: {
                                type: 'urn:problem:bad-request',
                                title: 'Bad Request',
                                detail: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
                                status: 400,
                                instance: '/tst/v1/channel/email/reply',
                            },
                        },
                    },
                },
            }),
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
            statusCode: 400,
            publicErrorCode: CHANNEL_HUB_REPLY_REJECTED,
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
                            reply_response: {
                                type: 'urn:problem:internal-server-error',
                                title: 'Internal Server Error',
                                detail: 'Upstream mail provider unavailable',
                                status: 503,
                                instance: '/tst/v1/channel/email/reply',
                            },
                        },
                    },
                },
            }),
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub rejected the reply',
            statusCode: 502,
        });
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });

    it('keeps the generic 502 when the reply response is empty and carries no problem+json', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({ data: { context: { channel_hub: { reply_response: {} } } } }),
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub rejected the reply',
            statusCode: 502,
        });
    });

    it('falls back to the error message, then a generic message, when Channel Hub failures carry no detail', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockRejectedValueOnce(new Error('network timeout'));
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'network timeout',
            statusCode: 400,
        });

        deps.workflowExecutor.execute.mockRejectedValueOnce({});
        await expect(replier.execute(dto({ case_id: uuidV4() }), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub request failed',
            statusCode: 400,
        });
    });

    it('rejects when Channel Hub accepts the reply but returns no message id', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({ data: { context: { channel_hub: { reply_response: { threadId: 't-1' } } } } }),
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({
            message: 'Channel Hub rejected the reply',
            statusCode: 502,
        });
    });

    it('defaults threadId, destination and case reference to null/empty when Channel Hub omits them', async () => {
        const deps = buildDeps({
            caseRepository: { find: jest.fn().mockResolvedValue({ id: { value: uuidV4() } }) },
        });
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({
                data: { context: { channel_hub: { reply_response: { messageId: 'msg-only', subject: 'Re: hi' } } } },
            }),
        });
        const replier = new EmailReplier(deps);

        await replier.execute(dto(), uuidV4());

        const savedEmail = deps.emailRepository.save.mock.calls[0][0];
        expect(savedEmail.thread_id.value).toBeNull();
        expect(savedEmail.subject.value).toBe('Re: hi');
        expect(savedEmail.to.value).toEqual([]);
        expect(savedEmail.case_reference_outbound.value).toBeNull();
    });

    // BUG (documented, not fixed): #execute defaults `subject` from the Channel Hub reply
    // response to `null` (`replyResp?.subject ?? null`) as if it were optional, but then
    // passes it straight into `new Email({ subject, ... })`, whose ValueObjectString for
    // `subject` is NOT nullable. When Channel Hub's reply omits the subject, this throws an
    // unhandled low-level domain error ("subject: The value cannot be null") instead of a
    // graceful CustomError, unlike the sibling "Channel Hub rejected the reply" 502 guard.
    it('throws an unhandled domain error (bug) when Channel Hub omits the subject entirely', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({ data: { context: { channel_hub: { reply_response: { messageId: 'msg-only' } } } } }),
        });
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toThrow('subject: The value cannot be null');
    });

    it('normalizes destination recipients given as a single object, a comma list, and mixed shapes', async () => {
        const deps = buildDeps();
        deps.workflowExecutor.execute.mockResolvedValue({
            toJson: () => ({
                data: {
                    context: {
                        channel_hub: {
                            reply_response: {
                                messageId: 'msg-1',
                                subject: 'Re: hi',
                                destination: {
                                    to: { email: 'single@example.com', name: 'Single' },
                                    cc: 'first@example.com, second@example.com',
                                    bcc: [{ address: 'from-address@example.com' }, { email: null }, null],
                                },
                            },
                        },
                    },
                },
            }),
        });
        const replier = new EmailReplier(deps);

        await replier.execute(dto(), uuidV4());

        const savedEmail = deps.emailRepository.save.mock.calls[0][0];
        expect(savedEmail.to.value).toEqual([{ email: 'single@example.com', name: 'Single' }]);
        expect(savedEmail.cc.value).toEqual([
            { email: 'first@example.com', name: null },
            { email: 'second@example.com', name: null },
        ]);
        expect(savedEmail.bcc.value).toEqual([{ email: 'from-address@example.com', name: null }]);
    });
});
