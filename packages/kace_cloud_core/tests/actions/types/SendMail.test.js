import { SendEmail } from '../../../src/actions/domain/types/SendEmail.js';
import { Action } from '../../../src/actions/index.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexTemplatesRepository } from '../../../src/templates/index.js';
import { KnexMailAccountRepository } from '../../../src/mail-accounts/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import TemplatesMother from '../../templates/domain/TemplatesMother.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { knexConfig } from '../../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { emailConfig } from '../../mails/smtp/domain/smtpConfig.js';
import { KnexSecretsVaultRepository } from '../../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { SecretsVaultMother } from '../../secrets-vault/domain/SecretsVaultMother.js';
import { KnexClientRepository } from '../../../src/clients/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexClassificationRepository } from '../../../src/classifications/index.js';
import { KnexAuxCasesRepository } from '../../../src/aux_casos/index.js';
import { KnexAuxClientsRepository } from '../../../src/aux_clientes/index.js';
import LocalTenantRepository from '../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

describe('SendMail', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const templatesRepository = new KnexTemplatesRepository(caseRepository.connection);
    const mailAccountRepository = new KnexMailAccountRepository(caseRepository.connection);
    const clientRepository = new KnexClientRepository(caseRepository.connection);
    const usersRepository = new KnexUsersRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(caseRepository.connection);
    const auxClientsRepository = new KnexAuxClientsRepository(caseRepository.connection);
    const secretsVaultRepository = new KnexSecretsVaultRepository(caseRepository.connection);
    const sendEmail = new SendEmail(
        templatesRepository,
        mailAccountRepository,
        clientRepository,
        usersRepository,
        classificationRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretsVaultRepository
    );

    it('should throw an error if the caseEntity is not a valid instance of Case', async () => {
        const invalidCase = {};
        const validAction = Action.create(ActionMother.dto({ template_id: uuidv4(), mail_account_id: uuidv4() }));
        const result = await sendEmail.execute(invalidCase, validAction);
        expect(result).toBe(false);
    });

    it('should throw an error if the action is not a valid instance of Action', async () => {
        const validCase = Case.create(CasesMother.dto());
        const invalidAction = {};
        const result = await sendEmail.execute(validCase, invalidAction);
        expect(result).toBe(false);
    });

    it('should return false if the template is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const validAction = Action.create(ActionMother.dto({ template_id: uuidv4(), mail_account_id: uuidv4() }));
        const result = await sendEmail.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if mail account is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const validTemplate = await TemplatesMother.createTemplate(templatesRepository);
        const validAction = Action.create(
            ActionMother.dto({ template_id: validTemplate.id.value, mail_account_id: uuidv4() })
        );

        const result = await sendEmail.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    // KACE-SKIP(decision-pendiente): la accion envio_correo acaba en SmtpEmailService y
    // envia correo real por SMTP_HOST/SMTP_USER/SMTP_PASS. Con claves en el .env manda
    // correo cada corrida; sin ellas paga el timeout de 120 s (este archivo tardo 298 s
    // en el baseline). Los mocks de tests/support/mocks/smtp.js siguen sin consumidor.
    it.skip('should return true and send email if all parameters are valid', async () => {
        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'smtp',
            ...emailConfig,
            from_address: 'test@mail.com',
        };
        const mailAccount = await MailAccount.create(mailAccountDTO);
        mailAccountRepository.save(mailAccount);

        const validCase = Case.create(CasesMother.dto());
        const validTemplate = await TemplatesMother.createTemplate(templatesRepository);
        const validAction = Action.create(
            ActionMother.dto({ template_id: validTemplate.id.value, mail_account_id: mailAccount.id.value })
        );

        const result = await sendEmail.execute(validCase, validAction);

        expect(result).toBe(true);
    });

    // KACE-SKIP(decision-pendiente): mismo envio real por SMTP_HOST/SMTP_USER/SMTP_PASS,
    // aqui con las credenciales sacadas del vault. Con claves en el .env manda correo;
    // sin ellas paga el timeout de 120 s. Los mocks de tests/support/mocks/smtp.js
    // existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should return true and send email with secrets-based mail account', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsVaultRepository, {
                referencia: 'SMTP_USERNAME_SECRET',
                secreto: emailConfig.username,
            });

            await SecretsVaultMother.createEncryptedSecret(secretsVaultRepository, {
                referencia: 'SMTP_PASSWORD_SECRET',
                secreto: emailConfig.password,
            });

            const mailAccountDTO = {
                ...MailAccountMother.dto(),
                type: 'smtp',
                ...emailConfig,
                username: 'SECRET_SMTP_USERNAME_SECRET',
                password: 'SECRET_SMTP_PASSWORD_SECRET',
                from_address: 'test@mail.com',
            };

            const mailAccount = await MailAccount.create(mailAccountDTO);
            await mailAccountRepository.save(mailAccount);

            const validCase = Case.create(CasesMother.dto());
            const validTemplate = await TemplatesMother.createTemplate(templatesRepository);
            const validAction = Action.create(
                ActionMother.dto({ template_id: validTemplate.id.value, mail_account_id: mailAccount.id.value })
            );

            const result = await sendEmail.execute(validCase, validAction);

            expect(result).toBe(true);
        });
    });

    // KACE-SKIP(decision-pendiente): mismo envio real por SMTP_HOST/SMTP_USER/SMTP_PASS y
    // ademas contra dos buzones corporativos escritos a mano en la plantilla. Con claves
    // en el .env manda correo a esas personas; sin ellas paga el timeout de 120 s. Los
    // mocks de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should return true and send email multiple destinataries', async () => {
        await TenantContext.run(tenant, async () => {
            await SecretsVaultMother.createEncryptedSecret(secretsVaultRepository, {
                referencia: 'H_MAIL_USERNAME',
                secreto: emailConfig.username,
            });

            await SecretsVaultMother.createEncryptedSecret(secretsVaultRepository, {
                referencia: 'H_MAIL_PASSWORD',
                secreto: emailConfig.password,
            });

            const mailAccountDTO = {
                ...MailAccountMother.dto(),
                type: 'smtp',
                tenant_id: null,
                client_id: null,
                client_secret: null,
                ...emailConfig,
                username: 'SECRET_SMTP_USERNAME_SECRET',
                password: 'SECRET_SMTP_PASSWORD_SECRET',
                from_address: 'test@mail.com',
            };

            const mailAccount = await MailAccount.create(mailAccountDTO);
            await mailAccountRepository.save(mailAccount);

            const validCase = Case.create(CasesMother.dto());
            const validTemplate = await TemplatesMother.createTemplate(templatesRepository, {
                destinatario: 'hildefonso.munoz@konecta.com,andres.yepes@konecta.com',
            });
            const validAction = Action.create(
                ActionMother.dto({ template_id: validTemplate.id.value, mail_account_id: mailAccount.id.value })
            );

            const result = await sendEmail.execute(validCase, validAction);

            expect(result).toBe(true);
        });
    });

    // KACE-SKIP(decision-pendiente): abre conexion real contra SMTP_HOST para provocar el
    // fallo de autenticacion, asi que depende del servidor de verdad aunque no llegue a
    // enviar. Con claves en el .env conecta; sin ellas paga el timeout de 120 s. Los mocks
    // de tests/support/mocks/smtp.js existen desde 0cc7a0ad4 y nadie los usa.
    it.skip('should return false and log event with success:false when SMTP credentials are invalid', async () => {
        const invalidEmailConfig = {
            ...emailConfig,
            password: 'invalid_password_for_test',
        };

        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'smtp',
            tenant_id: null,
            client_id: null,
            client_secret: null,
            ...invalidEmailConfig,
            from_address: 'test@mail.com',
        };

        const mailAccount = await MailAccount.create(mailAccountDTO);
        await mailAccountRepository.save(mailAccount);

        const validCase = Case.create(CasesMother.dto());
        const validTemplate = await TemplatesMother.createTemplate(templatesRepository);
        const validAction = Action.create(
            ActionMother.dto({ template_id: validTemplate.id.value, mail_account_id: mailAccount.id.value })
        );

        const result = await sendEmail.execute(validCase, validAction);

        expect(result).toBe(false);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ aggregate_id: validAction.id.value, event_name: 'action.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = typeof eventLog.body === 'string' ? JSON.parse(eventLog.body) : eventLog.body;
        expect(body.actionType).toBe('envio_correo');
        expect(body.success).toBe(false);
    });
});
