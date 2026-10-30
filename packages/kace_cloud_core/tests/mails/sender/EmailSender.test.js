import { emailConfig as gmailConfig, recipientEmail } from '../google/domain/gmailConfig.js';
import { emailConfig as msgraphConfig } from '../microsoft/domain/msgraphConfig.js';
import { emailConfig as smtpConfig } from '../smtp/domain/smtpConfig.js';
import { MailAccountsTypes } from '../../../src/shared/index.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import { EmailSender, Mail } from '../../../src/mails/index.js';
import { v4 as uuidv4 } from 'uuid';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';

describe('EmailSender', () => {
    let gmailAccount;
    let graphAccount;
    let smtpAccount;

    const createMail = (mailAccountId) =>
        Mail.create({
            id: uuidv4(),
            mail_account_id: mailAccountId,
            to: [recipientEmail],
            subject: 'Test email sender',
            content: 'Test BODY',
            cc: null,
            bcc: null,
            sent_status: 'PENDING',
            created_at: new Date(),
            created_by: uuidv4(),
        });

    beforeEach(async () => {
        gmailAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: MailAccountsTypes.GMAIL_USER.value,
            ...gmailConfig,
        });
        graphAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: MailAccountsTypes.MS_GRAPH_APPLICATION.value,
            ...msgraphConfig,
        });
        smtpAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: MailAccountsTypes.SMTP.value,
            ...smtpConfig,
        });
    });

    // KACE-SKIP(decision-pendiente): ya estaba skip en el commit que importo el
    // paquete completo (455126a15, 2025-11-03), sin comentario ni contexto. No se
    // encontro el motivo original en el historial: falta que alguien lo decida.
    it.skip('should send email using Microsoft Graph application', async () => {
        const mail = createMail(graphAccount.id.value);
        const emailSender = new EmailSender(mail, graphAccount);
        const status = await emailSender.send();

        expect(status).toBe('sent');
    });

    // KACE-SKIP(decision-pendiente): EmailSender.send acaba en SmtpEmailService y envia
    // correo real por SMTP_HOST/SMTP_USER/SMTP_PASS hacia TEST_RECIPIENT_EMAIL. Con claves
    // en el .env manda correo cada corrida; sin ellas falla o paga el timeout de 120 s.
    // Los mocks de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should send email using SMTP', async () => {
        const mail = createMail(smtpAccount.id.value);
        const emailSender = new EmailSender(mail, smtpAccount);
        const status = await emailSender.send();

        expect(status).toBe('sent');
    });

    it('should throw error for unsupported service account type', async () => {
        const mail = createMail(uuidv4());
        const mailAccount = { type: { value: 'unsupported_type' } };
        const emailSender = new EmailSender(mail, mailAccount);

        await expect(emailSender.send()).rejects.toThrow('Service account type not supported for send');
    });
});
