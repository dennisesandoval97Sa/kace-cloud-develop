import { jest } from '@jest/globals';
import { v4 as uuidV4 } from 'uuid';
import { EmailDetailFinder } from '../../src/emails/application/find/EmailDetailFinder.js';
import { Email } from '../../src/emails/domain/Email.js';
import { EmailAttachment } from '../../src/emails/domain/EmailAttachments.js';
import { EmailAttachmentMother } from './domain/EmailAttachmentMother.js';
import EmailMother from './domain/EmailsMother.js';

const EMAIL_ID = uuidV4();

const S3_URL = `https://mybucket.s3.amazonaws.com/attachments/${EMAIL_ID}/154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf`;
const LEGACY_URL = 'https://www.nintendo.com/eu/media/images/Mario.png';

function buildFinder(attachments) {
    const email = Email.create(EmailMother.dto({ id: EMAIL_ID, is_outbound: true }));
    const emailRepository = { find: jest.fn().mockResolvedValue(email) };
    const emailBodyRepository = { find: jest.fn().mockResolvedValue(null) };
    const attachmentsRepository = { findAllByEmailId: jest.fn().mockResolvedValue(attachments) };
    const interactionRepository = { findByEmailId: jest.fn().mockResolvedValue(null) };
    const interactionCasoRepo = { findByInteractionId: jest.fn().mockResolvedValue([]) };
    const caseRepository = { findSummaryByIds: jest.fn().mockResolvedValue([]) };
    const channelHubAccountRepository = { find: jest.fn().mockResolvedValue(null) };
    const workspaceRepository = { find: jest.fn().mockResolvedValue(null) };

    return new EmailDetailFinder(
        emailRepository,
        emailBodyRepository,
        attachmentsRepository,
        interactionRepository,
        interactionCasoRepo,
        caseRepository,
        channelHubAccountRepository,
        workspaceRepository
    );
}

describe('EmailDetailFinder attachments mapping', () => {
    it('returns folderId as id and prefixed basename as filename for S3 attachments', async () => {
        const attachment = EmailAttachment.create(
            EmailAttachmentMother.dto({
                email_id: EMAIL_ID,
                url: S3_URL,
                size: 2432353,
                filename: 'agentic-ai-serverless.pdf',
            })
        );
        const finder = buildFinder([attachment]);

        const result = await finder.execute(EMAIL_ID);

        expect(result.attachments).toEqual([
            {
                id: EMAIL_ID,
                url: S3_URL,
                filename: '154b6906-c0ae-497b-a5cc-ad9227a12cc8_agentic-ai-serverless.pdf',
                size: 2432353,
            },
        ]);
    });

    it('returns null id and filename for legacy non-S3 urls', async () => {
        const attachment = EmailAttachment.create(
            EmailAttachmentMother.dto({ email_id: EMAIL_ID, url: LEGACY_URL, size: 0, filename: null })
        );
        const finder = buildFinder([attachment]);

        const result = await finder.execute(EMAIL_ID);

        expect(result.attachments).toEqual([{ id: null, url: LEGACY_URL, filename: null, size: 0 }]);
    });
});
