import { v4 as uuidV4 } from 'uuid';
import { jest } from '@jest/globals';
import { CustomError } from '../../src/shared';
import { Email } from '../../src/emails/domain/Email';
import { Interaction } from '../../src/interactions/domain/Interaction.js';
import { EmailDetailFinder } from '../../src/emails/application/find/EmailDetailFinder.js';

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
            ...overrides,
        };
    }
}

class InteractionMother {
    static dto(overrides = {}) {
        return {
            id: uuidV4(),
            channel_id: 'email',
            client_identifier: uuidV4(),
            external_identifier: uuidV4(),
            description: 'Interaction de prueba',
            priority: 'high',
            is_closed: false,
            in_review: false,
            workspace_id: uuidV4(),
            conversation_id: uuidV4(),
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
            ...overrides,
        };
    }
}

const buildFinder = ({ email = null, interaction = null, pivotRows = [], cases = [] } = {}) => {
    const repos = {
        emailRepository: { find: jest.fn().mockResolvedValue(email) },
        emailBodyRepository: { find: jest.fn().mockResolvedValue(null) },
        attachmentsRepository: { findAllByEmailId: jest.fn().mockResolvedValue([]) },
        interactionRepository: { findByEmailId: jest.fn().mockResolvedValue(interaction) },
        interactionCasoRepo: { findByInteractionId: jest.fn().mockResolvedValue(pivotRows) },
        caseRepository: { findSummaryByIds: jest.fn().mockResolvedValue(cases) },
        channelHubAccountRepository: { find: jest.fn().mockResolvedValue({ email: { value: 'account@test.com' } }) },
        workspaceRepository: {
            find: jest.fn().mockResolvedValue({ description: { value: 'Workspace Emails' }, tag: { value: 'WSE' } }),
        },
    };

    const finder = new EmailDetailFinder(
        repos.emailRepository,
        repos.emailBodyRepository,
        repos.attachmentsRepository,
        repos.interactionRepository,
        repos.interactionCasoRepo,
        repos.caseRepository,
        repos.channelHubAccountRepository,
        repos.workspaceRepository
    );

    return { finder, repos };
};

describe('EmailDetailFinder', () => {
    it('throws 404 when email does not exist', async () => {
        const { finder } = buildFinder({ email: null });

        await expect(finder.execute(uuidV4())).rejects.toThrow(CustomError);
    });

    it('returns interaction null when the email has no interaction', async () => {
        const email = Email.create(EmailMother.dto());
        const { finder } = buildFinder({ email, interaction: null });

        const data = await finder.execute(email.id.value);

        expect(data.id).toEqual(email.id.value);
        expect(data.interaction).toBeNull();
        expect(data.cases).toEqual([]);
    });

    it('includes is_migrated in the interaction payload', async () => {
        const email = Email.create(EmailMother.dto());
        const interaction = Interaction.create(InteractionMother.dto({ is_migrated: true }));
        const { finder } = buildFinder({ email, interaction });

        const data = await finder.execute(email.id.value);

        expect(data.interaction).toEqual({
            id: interaction.id.value,
            workspace_id: interaction.workspace_id.value,
            workspace_name: 'Workspace Emails',
            tag: 'WSE',
            is_closed: false,
            in_review: false,
            priority: interaction.priority.value,
            is_migrated: true,
            created_at: interaction.created_at.value,
        });
    });

    it('defaults is_migrated to false when the interaction row does not have it', async () => {
        const email = Email.create(EmailMother.dto());
        const interaction = Interaction.create(InteractionMother.dto());
        const { finder } = buildFinder({ email, interaction });

        const data = await finder.execute(email.id.value);

        expect(data.interaction.is_migrated).toBe(false);
    });

    it('resolves the related cases when the interaction has pivot rows', async () => {
        const email = Email.create(EmailMother.dto());
        const interaction = Interaction.create(InteractionMother.dto());
        const caseId = uuidV4();
        const { finder } = buildFinder({
            email,
            interaction,
            pivotRows: [{ caso_id: caseId }],
            cases: [{ id: caseId, external_code: 'CASE-1', reference: 42, created_at: '2026-01-01T00:00:00.000Z' }],
        });

        const data = await finder.execute(email.id.value);

        expect(data.cases).toEqual([
            { id: caseId, external_code: 'CASE-1', reference: 42, created_at: '2026-01-01T00:00:00.000Z' },
        ]);
    });

    it('defaults case summary fields to null when the row omits them', async () => {
        const email = Email.create(EmailMother.dto());
        const interaction = Interaction.create(InteractionMother.dto());
        const caseId = uuidV4();
        const { finder } = buildFinder({
            email,
            interaction,
            pivotRows: [{ caso_id: caseId }],
            cases: [{ id: caseId }],
        });

        const data = await finder.execute(email.id.value);

        expect(data.cases).toEqual([{ id: caseId, external_code: null, reference: null, created_at: null }]);
    });

    it('defaults workspace_name and tag to null when the workspace cannot be found', async () => {
        const email = Email.create(EmailMother.dto());
        const interaction = Interaction.create(InteractionMother.dto());
        const { finder, repos } = buildFinder({ email, interaction });
        repos.workspaceRepository.find.mockResolvedValue(null);

        const data = await finder.execute(email.id.value);

        expect(data.interaction.workspace_name).toBeNull();
        expect(data.interaction.tag).toBeNull();
    });

    it('defaults interaction created_at to null when the interaction row is a leaner projection without it', async () => {
        const email = Email.create(EmailMother.dto());
        // Deliberately a plain object (not `Interaction.create(...)`): the domain's
        // ValueObjectTimestamp forbids a null created_at, so the only way to exercise
        // this defensive `?.value ?? null` fallback is a repository projection that
        // omits the field.
        const interaction = {
            id: { value: uuidV4() },
            workspace_id: { value: uuidV4() },
            is_closed: { value: false },
            in_review: { value: false },
            is_migrated: { value: false },
            priority: { value: 'high' },
        };
        const { finder } = buildFinder({ email, interaction });

        const data = await finder.execute(email.id.value);

        expect(data.interaction.created_at).toBeNull();
    });

    it('extracts the plain email string when wrapped, or keeps the raw entry otherwise', async () => {
        const rawEntry = { address: 'raw@test.com' };
        const email = Email.create(EmailMother.dto({ cc: [{ email: 'wrapped@test.com' }, rawEntry] }));
        const { finder } = buildFinder({ email });

        const data = await finder.execute(email.id.value);

        expect(data.cc).toEqual(['wrapped@test.com', rawEntry]);
    });

    it('defaults attachments to an empty list when the repository resolves null', async () => {
        const email = Email.create(EmailMother.dto());
        const { finder, repos } = buildFinder({ email });
        repos.attachmentsRepository.findAllByEmailId.mockResolvedValue(null);

        const data = await finder.execute(email.id.value);

        expect(data.attachments).toEqual([]);
    });
});
