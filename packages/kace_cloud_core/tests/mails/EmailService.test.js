import { EmailService, Mail } from '../../src/mails/index.js';
import { emailConfig as smtpConfig, recipientEmail } from './smtp/domain/smtpConfig.js';
import { v4 as uuidv4 } from 'uuid';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { knexConfig } from '../knexfile.js';
import { MailAccountsTypes, TenantContext, ValueObjectUuid } from '../../src/shared/index.js';
import { MailAccount } from '../../src/mail-accounts/index.js';
import MailAccountMother from '../mail-accounts/domain/MailAccountMother.js';
import { SecretsVaultMother } from '../secrets-vault/domain/SecretsVaultMother.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';

describe('EmailService - Integration', () => {
    const secretsRepository = new KnexSecretsVaultRepository(knexConfig);
    const emailService = new EmailService(secretsRepository);
    let smtpAccount;
    let tenant;

    const createMail = (mailAccountId) =>
        Mail.create({
            id: uuidv4(),
            mail_account_id: mailAccountId,
            to: [recipientEmail],
            subject: 'Test EmailService',
            content: 'Integration test BODY',
            cc: null,
            bcc: null,
            sent_status: 'PENDING',
            created_at: new Date(),
            created_by: uuidv4(),
        });

    beforeAll(async () => {
        tenant = await new LocalTenantRepository().find(ValueObjectUuid.random());
    });

    beforeEach(async () => {
        smtpAccount = await MailAccount.create({
            ...MailAccountMother.dto(),
            type: MailAccountsTypes.SMTP.value,
            ...smtpConfig,
            username: 'SECRET_SMTP_USERNAME_SECRET',
            password: 'SECRET_SMTP_PASSWORD_SECRET',
        });
    });

    afterAll(async () => {
        await secretsRepository.destroyConnection();
    });

    // KACE-SKIP(decision-pendiente): EmailService.execute acaba en SmtpEmailService y
    // envia correo real por SMTP_HOST/SMTP_USER/SMTP_PASS hacia TEST_RECIPIENT_EMAIL.
    // Con claves en el .env manda correo; sin ellas paga el timeout de 120 s. Los mocks
    // de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should send email using SMTP account with vault secrets', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'SMTP_USERNAME_SECRET',
                secreto: smtpConfig.username,
            });

            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'SMTP_PASSWORD_SECRET',
                secreto: smtpConfig.password,
            });

            const mail = createMail(smtpAccount.id.value);
            const status = await emailService.execute(mail, smtpAccount);

            expect(status).toBe('sent');
        });
    });

    // KACE-SKIP(decision-pendiente): igual que el anterior, la resolucion de secretos se
    // comprueba despues de un envio real por SMTP_HOST/SMTP_USER/SMTP_PASS hacia
    // TEST_RECIPIENT_EMAIL: con claves en el .env manda correo, sin ellas timeout de 120 s.
    // Los mocks de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should resolve secrets before sending: username and password must be resolved', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'SMTP_USERNAME_SECRET',
                secreto: smtpConfig.username,
            });

            await SecretsVaultMother.createEncryptedSecret(secretsRepository, {
                referencia: 'SMTP_PASSWORD_SECRET',
                secreto: smtpConfig.password,
            });

            const mail = createMail(smtpAccount.id.value);

            expect(smtpAccount.username.isResolved).toBe(false);
            expect(smtpAccount.password.isResolved).toBe(false);

            await emailService.execute(mail, smtpAccount);

            expect(smtpAccount.username.isResolved).toBe(true);
            expect(smtpAccount.password.isResolved).toBe(true);
            expect(smtpAccount.username.value).toBe(smtpConfig.username);
            expect(smtpAccount.password.value).toBe(smtpConfig.password);
        });
    });

    // KACE-SKIP(decision-pendiente): tambien llama a execute, o sea que abre conexion real
    // contra SMTP_HOST con las credenciales sin resolver. Con claves en el .env intenta el
    // envio contra el servidor de verdad; sin ellas paga el timeout de 120 s. Los mocks de
    // tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should not resolve secrets when they do not exist in vault', async () => {
        await TenantContext.run(tenant, async () => {
            const mail = createMail(smtpAccount.id.value);
            await emailService.execute(mail, smtpAccount);

            // No secrets in DB: username/password must remain as the original SECRET_* references
            expect(smtpAccount.username.isResolved).toBe(false);
            expect(smtpAccount.password.isResolved).toBe(false);
            expect(smtpAccount.username.value).toBe('SECRET_SMTP_USERNAME_SECRET');
            expect(smtpAccount.password.value).toBe('SECRET_SMTP_PASSWORD_SECRET');
        });
    });

    it('should throw error for unsupported service account type', async () => {
        const mail = createMail(uuidv4());
        const invalidAccount = { type: { value: 'invalid_type' } };

        await expect(emailService.execute(mail, invalidAccount)).rejects.toThrow(
            'Service account type not supported for send'
        );
    });
});
