import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';

jest.unstable_mockModule('../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js', () => ({
    buildEmailTemplateContext: jest.fn().mockResolvedValue({}),
    replaceTemplateVariables: jest.fn((text) => text),
    renderRecipientList: jest.fn((field, value) => value ?? []),
    parseEmailList: jest.fn((value) => value ?? []),
    renderEmailsOrFail: jest.fn((field, value) => value ?? []),
}));

const { EmailReplier } = await import('../../src/emails/application/reply/EmailReplier.js');
const { CustomError } = await import('../../src/shared/errors/CustomError.js');

const S3_URL = 'https://mybucket.s3.amazonaws.com/attachments/abc-123/154b6906-c0ae-497b-a5cc-ad9227a12cc8_doc.pdf';

function buildDeps() {
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
            prepare: jest.fn().mockResolvedValue([{ url: S3_URL, filename: 'doc.pdf', size: 100 }]),
            persist: jest.fn().mockResolvedValue(undefined),
        },
        clientFinder: {},
        userFinder: {},
        classificationFinder: {},
        auxCasesFinder: {},
        auxClientsFinder: {},
    };
}

function dto() {
    return {
        case_id: uuidV4(),
        interaction_id: uuidV4(),
        from: 'a@b.com',
        in_reply_to: 'orig-msg-id',
        reply_message_to_send: 'm',
        is_reply_all: false,
        attachments: [S3_URL],
    };
}

describe('EmailReplier attachments', () => {
    it('prepares attachments before calling Channel Hub and persists them after', async () => {
        const deps = buildDeps();
        const replier = new EmailReplier(deps);

        const result = await replier.execute(dto(), uuidV4());

        expect(deps.attachmentPersister.prepare).toHaveBeenCalledWith([S3_URL]);
        expect(deps.attachmentPersister.prepare.mock.invocationCallOrder[0]).toBeLessThan(
            deps.workflowExecutor.execute.mock.invocationCallOrder[0]
        );
        expect(deps.attachmentPersister.persist.mock.invocationCallOrder[0]).toBeGreaterThan(
            deps.workflowExecutor.execute.mock.invocationCallOrder[0]
        );
        expect(deps.attachmentPersister.persist).toHaveBeenCalledWith({
            emailId: result.id,
            attachments: [{ url: S3_URL, filename: 'doc.pdf', size: 100 }],
            userId: expect.any(String),
            now: expect.any(Date),
        });
    });

    it('aborts the reply (no Channel Hub call) when prepare fails', async () => {
        const deps = buildDeps();
        deps.attachmentPersister.prepare.mockRejectedValue(new CustomError('Attachment not found in storage: x', 422));
        const replier = new EmailReplier(deps);

        await expect(replier.execute(dto(), uuidV4())).rejects.toMatchObject({ statusCode: 422 });
        expect(deps.workflowExecutor.execute).not.toHaveBeenCalled();
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });
});
