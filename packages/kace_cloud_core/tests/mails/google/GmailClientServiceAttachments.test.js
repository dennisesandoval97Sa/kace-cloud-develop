import { MailAccount } from '../../../src/mail-accounts/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { emailConfig } from './domain/gmailConfig.js';
import { GmailClientService } from '../../../src/mails/index.js';

describe('GmailClientService attachments', () => {
    it('builds a multipart/mixed raw MIME message when attachments are present', async () => {
        const mailAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: 'gmail_user',
            ...emailConfig,
        });
        const service = new GmailClientService(mailAccount);

        const mime = service.createEmailMessage(
            ['customer@example.com'],
            'Subject',
            '<p>Body</p>',
            [],
            [],
            [
                {
                    filename: 'case-file.txt',
                    contentType: 'text/plain',
                    content: Buffer.from('case content'),
                },
            ]
        );

        expect(mime).toContain('Content-Type: multipart/mixed; boundary=');
        expect(mime).toContain('Content-Type: text/plain; name="case-file.txt"');
        expect(mime).toContain('Content-Disposition: attachment; filename="case-file.txt"');
        expect(mime).toContain(Buffer.from('case content').toString('base64'));
    });
});
