import { jest } from '@jest/globals';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { emailConfig } from './domain/smtpConfig.js';
import LocalTenantRepository from '../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../../src/shared/infrastructure/context/TenantContext.js';
import { SmtpEmailService } from '../../../src/mails/index.js';
import { Helper } from '../../../src/shared/index.js';

const tenant = await new LocalTenantRepository().find();

describe('SmtpEmailService attachments', () => {
    beforeEach(() => {
        jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('maps provider-neutral attachments to nodemailer mail options', async () => {
        await TenantContext.run(tenant, async () => {
            const mailAccount = await MailAccount.create({
                ...MailAccountMother.dto(),
                type: 'smtp',
                ...emailConfig,
            });
            const service = new SmtpEmailService(mailAccount);
            const attachment = {
                filename: 'case-file.txt',
                contentType: 'text/plain',
                content: Buffer.from('case content'),
            };

            expect(
                service.createMailOptions('Subject', '<p>Body</p>', ['customer@example.com'], [], [], [attachment])
            ).toEqual(
                expect.objectContaining({
                    subject: 'Subject',
                    html: '<p>Body</p>',
                    attachments: [attachment],
                })
            );
        });
    });
});
