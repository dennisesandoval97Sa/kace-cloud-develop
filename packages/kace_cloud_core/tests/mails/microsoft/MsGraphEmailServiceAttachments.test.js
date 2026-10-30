import { MailAccount } from '../../../src/mail-accounts/index.js';
import { MsGraphEmailService } from '../../../src/mails/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { emailConfig } from './domain/msgraphConfig.js';

describe('MsGraphEmailService attachments', () => {
    it('maps provider-neutral attachments to Microsoft Graph fileAttachment payloads', async () => {
        const mailAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: 'ms_graph_application',
            ...emailConfig,
        });
        const service = new MsGraphEmailService(mailAccount);

        const mail = service.createMailObject(
            ['customer@example.com'],
            'Subject',
            '<p>Body</p>',
            ['copy@example.com'],
            ['hidden@example.com'],
            [
                {
                    filename: 'case-file.txt',
                    contentType: 'text/plain',
                    content: Buffer.from('case content'),
                },
            ]
        );

        expect(mail.message.ccRecipients).toHaveLength(1);
        expect(mail.message.bccRecipients).toHaveLength(1);
        expect(mail.message.attachments).toEqual([
            {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: 'case-file.txt',
                contentType: 'text/plain',
                contentBytes: Buffer.from('case content').toString('base64'),
            },
        ]);
    });
});
