import { v4 as uuidv4 } from 'uuid';
import { Mail } from '../../src/mails/index.js';

describe('Mail attachments', () => {
    it('keeps provider-neutral attachments on the Mail aggregate', () => {
        const attachment = {
            filename: 'case-file.txt',
            contentType: 'text/plain',
            content: Buffer.from('case content'),
        };

        const mail = Mail.create({
            id: uuidv4(),
            mail_account_id: uuidv4(),
            to: ['customer@example.com'],
            subject: 'Case update',
            content: '<p>Hello</p>',
            sent_status: 'PENDING',
            created_at: new Date(),
            created_by: uuidv4(),
            attachments: [attachment],
        });

        expect(mail.attachments.value).toEqual([attachment]);
    });
});
