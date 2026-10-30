import { emailConfig, recipientEmail } from './domain/gmailConfig.js';
import { GmailClientService } from '../../../src/mails/index.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';

// TODO: Requerimos cuenta para probar con gmail
// KACE-SKIP(decision-pendiente): abre conexion real contra gmail.googleapis.com.
// Segun la decision de la fase 1, Gmail va mockeado; queda pendiente reescribirlo.
describe.skip('Authentication Integration Tests', () => {
    let mailAccount;
    let gmailService;

    beforeEach(async () => {
        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'gmail_user',
            ...emailConfig,
        };
        mailAccount = await MailAccount.create(mailAccountDTO);
        gmailService = new GmailClientService(mailAccount);
    });

    it('should refresh access token', async () => {
        // escapa este test
        e;
        const credentials = await gmailService.refreshAccessToken();
        expect(credentials).toHaveProperty('access_token');
    });

    it('should send email', async () => {
        const to = recipientEmail;
        const subject = 'Test Subject';
        const body = 'Test Body';

        const info = await gmailService.sendMailUser(to, subject, body);
        expect(info).toHaveProperty('id');
        expect(info.id).toBeTruthy();
    });
});
