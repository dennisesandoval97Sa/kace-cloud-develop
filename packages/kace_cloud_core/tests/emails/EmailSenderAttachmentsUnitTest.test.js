import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';

jest.unstable_mockModule('../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js', () => ({
    buildEmailTemplateContext: jest.fn().mockResolvedValue({}),
    replaceTemplateVariables: jest.fn((text) => text),
    renderRecipientList: jest.fn((field, value) => value ?? []),
    parseEmailList: jest.fn((v) => v),
    renderEmailsOrFail: jest.fn((field, value) => value ?? []),
}));

const { EmailSender } = await import('../../src/emails/application/send/EmailSender.js');
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
        workspaceRepository: {
            findDefaultInboxWorkspace: jest.fn().mockResolvedValue({ id: { value: uuidV4() } }),
        },
        workflowExecutor: {
            execute: jest.fn().mockResolvedValue({
                toJson: () => ({ data: { context: { channel_hub: { send_response: { messageId: 'msg-1' } } } } }),
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
        to: ['c@d.com'],
        subject: 's',
        message_to_send: 'm',
        attachments: [S3_URL],
    };
}

describe('EmailSender attachments', () => {
    it('prepares attachments before calling Channel Hub and persists them after', async () => {
        const deps = buildDeps();
        const sender = new EmailSender(deps);

        const result = await sender.execute(dto(), uuidV4());

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

    it('uses the interaction workspace when interaction_id is provided', async () => {
        const deps = buildDeps();
        const workspaceId = uuidV4();
        deps.interactionRepository.find.mockResolvedValue({ workspace_id: { value: workspaceId } });
        const sender = new EmailSender(deps);

        await sender.execute(dto(), uuidV4());

        expect(deps.interactionRepository.find).toHaveBeenCalled();
        expect(deps.workspaceRepository.findDefaultInboxWorkspace).not.toHaveBeenCalled();
        expect(deps.emailRepository.save.mock.calls[0][0].workspace_id.value).toBe(workspaceId);
    });

    it('falls back to the default INBOX workspace when interaction_id is missing', async () => {
        const deps = buildDeps();
        const inboxId = uuidV4();
        deps.workspaceRepository.findDefaultInboxWorkspace.mockResolvedValue({ id: { value: inboxId } });
        const sender = new EmailSender(deps);

        const payload = dto();
        delete payload.interaction_id;
        await sender.execute(payload, uuidV4());

        expect(deps.interactionRepository.find).not.toHaveBeenCalled();
        expect(deps.workspaceRepository.findDefaultInboxWorkspace).toHaveBeenCalled();
        expect(deps.emailRepository.save.mock.calls[0][0].workspace_id.value).toBe(inboxId);
    });

    it('falls back to the default INBOX workspace when the interaction is not found', async () => {
        const deps = buildDeps();
        const inboxId = uuidV4();
        deps.interactionRepository.find.mockResolvedValue(null);
        deps.workspaceRepository.findDefaultInboxWorkspace.mockResolvedValue({ id: { value: inboxId } });
        const sender = new EmailSender(deps);

        await sender.execute(dto(), uuidV4());

        expect(deps.interactionRepository.find).toHaveBeenCalled();
        expect(deps.workspaceRepository.findDefaultInboxWorkspace).toHaveBeenCalled();
        expect(deps.emailRepository.save.mock.calls[0][0].workspace_id.value).toBe(inboxId);
    });

    it('rejects with 422 when no interaction and no default INBOX workspace exists', async () => {
        const deps = buildDeps();
        deps.workspaceRepository.findDefaultInboxWorkspace.mockResolvedValue(null);
        const sender = new EmailSender(deps);

        const payload = dto();
        delete payload.interaction_id;

        await expect(sender.execute(payload, uuidV4())).rejects.toMatchObject({ statusCode: 422 });
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });

    it('aborts the send (no Channel Hub call) when prepare fails', async () => {
        const deps = buildDeps();
        deps.attachmentPersister.prepare.mockRejectedValue(new CustomError('Attachment not found in storage: x', 422));
        const sender = new EmailSender(deps);

        await expect(sender.execute(dto(), uuidV4())).rejects.toMatchObject({ statusCode: 422 });
        expect(deps.workflowExecutor.execute).not.toHaveBeenCalled();
        expect(deps.emailRepository.save).not.toHaveBeenCalled();
    });
});
