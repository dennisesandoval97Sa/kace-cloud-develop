import { v4 as uuid } from 'uuid';
import { emailConfig } from '../../mails/smtp/domain/smtpConfig.js';
import { mockSmtp } from '../../support/mocks/smtp.js';

/**
 * El envio se hace contra un `nodemailer` simulado. Antes este archivo abria una
 * conexion SMTP de verdad contra SMTP_HOST/SMTP_USER/SMTP_PASS del .env, igual
 * que `tests/mails/smtp/SmtpEmailService.test.js` -que por eso esta en skip-.
 * Como `jest.unstable_mockModule` solo alcanza a los modulos cargados despues de
 * declararlo, todo lo que arrastra a `nodemailer` se importa de forma dinamica
 * aqui abajo.
 */
const { transporter } = mockSmtp();

const { SendEmail } = await import('../../../src/actions/domain/types/SendEmail.js');
const { Action } = await import('../../../src/actions/index.js');
const { ActionTypes } = await import('../../../src/actions/domain/ActionTypes.js');
const { Case } = await import('../../../src/cases/index.js');
const { KnexTemplatesRepository } = await import('../../../src/templates/index.js');
const { KnexMailAccountRepository, MailAccount } = await import('../../../src/mail-accounts/index.js');
const { default: ActionMother } = await import('../../actions/domain/ActionMother.js');
const { default: CasesMother } = await import('../../cases/domain/CasesMother.js');
const { default: TemplatesMother } = await import('../../templates/domain/TemplatesMother.js');
const { default: MailAccountMother } = await import('../../mail-accounts/domain/MailAccountMother.js');
const { default: ClientMother } = await import('../../clients/domain/ClientMother.js');
const { default: UsersMother } = await import('../../users/domain/UsersMother.js');
const { default: ClassificationsMother } = await import('../../classifications/domain/ClassificationsMother.js');
const { knexConfig } = await import('../../knexfile.js');
const { KnexClientRepository, ClientFinder } = await import('../../../src/clients/index.js');
const { KnexUsersRepository } = await import('../../../src/users/index.js');
const { KnexClassificationRepository, ClassificationFinder } = await import('../../../src/classifications/index.js');
const { KnexAuxCasesRepository, AuxCasesFinder } = await import('../../../src/aux_casos/index.js');
const { KnexAuxClientsRepository, AuxClientsFinder } = await import('../../../src/aux_clientes/index.js');
const { TemplateUpdater } = await import('../../../src/templates/application/update/TemplateUpdater.js');
const { UserFinder } = await import('../../../src/users/domain/UserFinder.js');
const { replaceTemplateVariables, buildEmailTemplateContext } =
    await import('../../../src/actions/domain/types/emailTemplatesUtils.js');
const { KnexSecretsVaultRepository } =
    await import('../../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js');
const { TenantContext } = await import('../../../src/shared/infrastructure/context/TenantContext.js');
const { default: LocalTenantRepository } =
    await import('../../../src/tenant/infrastructure/local/LocalTenantRepository.js');

const tenant = await new LocalTenantRepository().find();

describe('TemplateVariablesReplacement', () => {
    const mailAccountRepository = new KnexMailAccountRepository(knexConfig);
    const clientRepository = new KnexClientRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    const templatesRepository = new KnexTemplatesRepository(knexConfig);
    const auxCasesRepository = new KnexAuxCasesRepository(knexConfig);
    const auxClientsRepository = new KnexAuxClientsRepository(knexConfig);
    const secretsVaultRepository = new KnexSecretsVaultRepository(mailAccountRepository.connection);
    const sendEmail = new SendEmail(
        templatesRepository,
        mailAccountRepository,
        clientRepository,
        userRepository,
        classificationRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretsVaultRepository
    );
    const knex = auxCasesRepository.connection;

    it('reemplaza variables simples correctamente', () => {
        const template = 'Hola {{cliente.nombres}} {{cliente.apellido1}}';
        const context = {
            clients: {
                nombres: 'Nombre',
                apellido1: 'Apellido',
            },
        };

        const result = replaceTemplateVariables(template, context);
        expect(result).toBe('Hola Nombre Apellido');
    });

    it('deja variables sin reemplazar si no existen en el contexto', () => {
        const template = 'Estimado {{cliente.apellido2}}';
        const context = { cliente: { apellido1: 'Apellido' } };

        const result = replaceTemplateVariables(template, context);
        expect(result).toBe('Estimado ');
    });
    it('envía un correo con los valores reemplazados', async () => {
        const template = await TemplatesMother.createTemplate(templatesRepository);
        const templateUpdater = new TemplateUpdater(templatesRepository);
        const data = {
            descripcion: `Lorem Ipsum ${template.id.value}`,
            destinatario: '{{clients.email}},{{usuarios.email}},{{aux_clients.correo}}',
            copia: '{{usuarios.email}}',
            copia_oculta: '{{responsable.email}}',
            asunto: 'Asunto para {{clients.nombres}} de {{aux_clients.ciudad}} ',
            cuerpo: '<p class="mb-1" dir="ltr"><span>Hola {{clients.nombres}} {{cliente.apellido1}}</span></p><p class="mb-1" dir="ltr"><span>Responsable {{responsable.nombres}}</span></p><p class="mb-1"><br></p><p class="mb-1" dir="ltr"><span>Clasificacion {{clasificaciones.nivel4}}</span></p><p class="mb-1" dir="ltr"><span>Clasificacion {{clasificacion.nivel3}}</span></p><p class="mb-1" dir="ltr"><span>Respuesta Caso: {{aux_cases.form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90.respuesta1}}</span></p><span>Observación del caso: {{aux_cases.form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90.observacionDelCaso}}</span>',
        };
        await templateUpdater.execute(template.id.value, data);
        const mailAccountDTO = {
            ...MailAccountMother.dto(),
            type: 'smtp',
            ...emailConfig,
            from_address: 'test@mail.com',
        };
        const mailAccount = MailAccount.create(mailAccountDTO);
        await mailAccountRepository.save(mailAccount);
        const client = await ClientMother.createClient(clientRepository);
        const user = await UsersMother.createUser(userRepository);
        const classification = await ClassificationsMother.createClassification(classificationRepository);

        const caseEntity = Case.create(
            CasesMother.dto({
                cliente_id: client.id.value,
                responsable_id: user.id.value,
                clasificacion_id: classification.id.value,
                created_by: user.id.value,
            })
        );

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );

        const auxClientsData = {
            ciudad: 'Medellín',
            correo: 'test@mail.com',
        };

        const auxCasesData = {
            'form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90': {
                respuesta1: 'Iniciado',
                observacionDelCaso: 'Esto es una observación del caso',
            },
        };
        const id = uuid();

        await knex('aux_clients').insert({
            id: id,
            cliente_id: client.id.value,
            data: JSON.stringify(auxClientsData),
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
            created_by: user.id.value,
        });

        await knex('aux_cases').insert({
            id: id,
            caso_id: caseEntity.id.value,
            data: JSON.stringify(auxCasesData),
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
            created_by: user.id.value,
        });

        const context = await buildEmailTemplateContext({
            entity: caseEntity,
            clientFinder: new ClientFinder(clientRepository),
            userFinder: new UserFinder(userRepository),
            classificationFinder: new ClassificationFinder(classificationRepository),
            auxCasesFinder: new AuxCasesFinder(auxCasesRepository),
            auxClientsFinder: new AuxClientsFinder(auxClientsRepository),
        });

        const renderedRecipient = replaceTemplateVariables(data.destinatario, context);
        const renderedSubject = replaceTemplateVariables(data.asunto, context);
        const renderedBody = replaceTemplateVariables(data.cuerpo, context);

        expect(renderedBody).toContain(context.clients.apellido1);
        expect(renderedSubject).toContain(context.clients.nombres);
        expect(renderedSubject).toContain(context.aux_clients.ciudad);
        expect(renderedRecipient).toContain(context.clients.email);
        expect(renderedBody).toContain(context.usuarios.nombres);
        expect(renderedBody).toContain(context.clasificaciones.nivel4);
        expect(renderedBody).toContain(context.aux_cases['form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90'].respuesta1);
        expect(renderedBody).toContain(
            context.aux_cases['form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90'].observacionDelCaso
        );

        // `SmtpEmailService` lee `TenantContext.getTenant().apps_environment`, asi
        // que sin contexto de tenant el envio revienta antes de llegar al mock.
        const result = await TenantContext.run(tenant, () => sendEmail.execute(caseEntity, action));

        expect(result).toBe(true);
        expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    });
});

describe('Date formatting with timezone', () => {
    it('reemplaza fechas UTC con hora local en zona horaria del tenant', () => {
        const template = 'Su caso fue creado el {{created_at}} y actualizado el {{updated_at}}';
        const context = {
            created_at: '2026-01-15T15:00:00Z', // 3 PM UTC = 10 AM Bogotá (UTC-5)
            updated_at: '2026-01-16T20:30:00Z', // 8:30 PM UTC = 3:30 PM Bogotá (UTC-5)
        };

        const result = replaceTemplateVariables(template, context, false, 'America/Bogota');

        expect(result).toBe('Su caso fue creado el 2026/01/15 10:00:00 y actualizado el 2026/01/16 15:30:00');
        expect(result).not.toContain('Z');
    });

    it('reemplaza fechas UTC con hora local en zona horaria con offset positivo', () => {
        const template = 'Creado: {{created_at}}';
        const context = {
            created_at: '2026-01-15T15:00:00Z', // 3 PM UTC = 8:30 PM IST (UTC+5:30)
        };

        const result = replaceTemplateVariables(template, context, false, 'Asia/Kolkata');

        expect(result).toBe('Creado: 2026/01/15 20:30:00');
    });

    it('detecta fechas ISO válidas en diferentes formatos', () => {
        const template = 'Fecha 1: {{date1}}, Fecha 2: {{date2}}, Fecha 3: {{date3}}';
        const context = {
            date1: '2026-01-15T15:00:00Z',
            date2: '2026-01-15T15:00:00.000Z',
            date3: '2026-01-15T15:00:00+05:30',
        };

        const result = replaceTemplateVariables(template, context);

        // Todas las fechas deben ser reemplazadas y formateadas
        const datePattern = /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/g;
        const matches = result.match(datePattern);
        expect(matches).toHaveLength(3);
    });

    it('no modifica campos que no son fechas ISO válidas', () => {
        const template = 'Email: {{email}}, Teléfono: {{phone}}, Texto: {{description}}';
        const context = {
            email: 'test@example.com',
            phone: '1234567890',
            description: 'Una descripción de prueba',
        };

        const result = replaceTemplateVariables(template, context);

        expect(result).toContain('test@example.com');
        expect(result).toContain('1234567890');
        expect(result).toContain('Una descripción de prueba');
    });

    it('mezcla correctamente campos de fecha y no-fecha', () => {
        const template = 'Cliente: {{client_name}} creó el caso el {{created_at}} con descripción: {{description}}';
        const context = {
            client_name: 'Juan Pérez',
            created_at: '2026-01-15T10:30:00Z',
            description: 'Caso crítico de acceso',
        };

        const result = replaceTemplateVariables(template, context);

        expect(result).toContain('Juan Pérez');
        expect(result).toContain('Caso crítico de acceso');
        expect(result).toMatch(/2026\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('maneja fechas ISO inválidas retornando el valor original', () => {
        const template = 'Intento de fecha: {{invalid_date}}';
        const context = {
            invalid_date: '2026-13-45T25:61:61Z', // Fecha inválida
        };

        const result = replaceTemplateVariables(template, context);

        // Debe retornar el valor original si no es una fecha válida
        expect(result).toContain('2026-13-45T25:61:61Z');
    });

    it('maneja correctamente variables anidadas con contexto de fecha', () => {
        const template = 'Usuario: {{usuarios.nombres}} actualizado el {{usuarios.updated_at}}';
        const context = {
            usuarios: {
                nombres: 'Carlos López',
                updated_at: '2026-01-20T14:45:00Z',
            },
        };

        const result = replaceTemplateVariables(template, context);

        expect(result).toContain('Carlos López');
        expect(result).toMatch(/2026\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it('reemplaza variables simples sin cambiar su función forEmail', () => {
        const template = 'Hola {{nombres}} {{apellido}}';
        const context = {
            nombres: 'María',
            apellido: 'González',
        };

        const result = replaceTemplateVariables(template, context, true);

        expect(result).toBe('Hola María González');
    });

    it('retorna "" para variables no encontradas cuando forEmail es false', () => {
        const template = 'Valor: {{nonexistent}}';
        const context = {
            other_field: 'valor',
        };

        const result = replaceTemplateVariables(template, context, false);

        expect(result).toBe('Valor: ');
    });

    it('retorna {{key}} para variables no encontradas cuando forEmail es true', () => {
        const template = 'Valor: {{nonexistent}}';
        const context = {
            other_field: 'valor',
        };

        const result = replaceTemplateVariables(template, context, true);

        expect(result).toBe('Valor: {{nonexistent}}');
    });

    it('formatea fechas en formato 24 horas sin AM/PM', () => {
        const template = 'Creado a las {{created_at}} y actualizado a las {{updated_at}}';
        const context = {
            created_at: '2026-01-15T15:30:00Z', // 3:30 PM UTC
            updated_at: '2026-01-15T08:45:00Z', // 8:45 AM UTC
        };

        const result = replaceTemplateVariables(template, context);

        const timePattern = /\d{4}\/\d{2}\/\d{2} (\d{2}):(\d{2}):(\d{2})/g;
        const matches = result.match(timePattern);

        expect(matches).toHaveLength(2);

        matches.forEach((match) => {
            const hourMatch = match.match(/(\d{2}):\d{2}:\d{2}$/);
            const hour = parseInt(hourMatch[1], 10);
            expect(hour).toBeGreaterThanOrEqual(0);
            expect(hour).toBeLessThanOrEqual(23);
        });

        expect(result).not.toMatch(/[AP]M/i);
    });

    it('formatea múltiples fechas en diferentes campos del contexto', () => {
        const template = `
            Creado: {{cases.created_at}}
            Actualizado: {{cases.updated_at}}
            Responsable desde: {{usuarios.created_at}}
            Cliente desde: {{clients.created_at}}
        `;
        const context = {
            cases: {
                created_at: '2026-01-10T08:00:00Z',
                updated_at: '2026-01-15T16:45:00Z',
            },
            usuarios: {
                created_at: '2025-06-01T09:30:00Z',
            },
            clients: {
                created_at: '2024-01-01T12:00:00Z',
            },
        };

        const result = replaceTemplateVariables(template, context);

        const datePattern = /\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/g;
        const matches = result.match(datePattern);
        expect(matches).toHaveLength(4);
    });
});
