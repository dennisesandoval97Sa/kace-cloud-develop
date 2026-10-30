import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { emailConfig, recipientEmail } from './domain/smtpConfig.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import { SmtpEmailService } from '../../../src/mails/index.js';
import { Helper } from '../../../src/shared/infrastructure/utils/Helper.js';
import LocalTenantRepository from '../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

// KACE-SKIP(decision-pendiente): envia correo real por el servidor que digan
// SMTP_HOST/SMTP_USER/SMTP_PASS hacia TEST_RECIPIENT_EMAIL. Con esas claves en el
// .env la suite manda correo cada vez que corre; sin ellas paga el timeout de 120 s.
// Los mocks de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
describe.skip('SmtpEmailService', () => {
    let mailAccount;

    beforeEach(async () => {
        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'smtp',
            ...emailConfig,
        };
        mailAccount = await MailAccount.create(mailAccountDTO);
    });

    it('should send mail with correct options', async () => {
        await TenantContext.run(tenant, async () => {
            const smtpService = new SmtpEmailService(mailAccount);

            const subject = 'Test Subject';
            const body = '<h1>Test Body</h1>';
            const to = [recipientEmail];
            const cc = [];
            const bcc = [];

            const response = await smtpService.sendEmail(subject, body, to, cc, bcc);
            Helper.logInfo(response);
            expect(response).toHaveProperty('messageId');
            expect(response.success).toEqual(true);
        });
    });
});
