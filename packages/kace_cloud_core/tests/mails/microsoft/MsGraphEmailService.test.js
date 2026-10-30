import { emailConfig, recipientEmail } from './domain/msgraphConfig.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import { MsGraphEmailService } from '../../../src/mails/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';

// KACE-SKIP(decision-pendiente): mismo caso que GmailClientService, contra
// Microsoft Graph. La decision de la fase 1 dice mockear; falta reescribirlo.
describe.skip('MsGraphEmailService', () => {
    let mailAccount;
    let graphEmailService;

    beforeEach(async () => {
        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'ms_graph_application',
            ...emailConfig,
        };
        mailAccount = await MailAccount.create(mailAccountDTO);
        graphEmailService = new MsGraphEmailService(mailAccount);
    });

    it('should initialize correctly', () => {
        expect(graphEmailService.client).toBeDefined();
    });

    it('should obtain a token successfully', async () => {
        const token = await graphEmailService.getToken();
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
    });

    it('should handle errors when obtaining the token', async () => {
        const invalidConfig = await MailAccount.create(MailAccountMother.dto());

        const invalidGraphEmailService = new MsGraphEmailService(invalidConfig);

        await expect(invalidGraphEmailService.getToken()).rejects.toThrow('Error obtaining the token');
    });

    it('sendEmail should send an email', async () => {
        const email = {
            to: [recipientEmail],
            subject: 'Test Subject',
            body: 'Test Body',
        };

        await expect(graphEmailService.sendEmail(email.to, email.subject, email.body)).resolves.not.toThrow();
    });
});
