import { jest } from '@jest/globals';
import { SendEmail } from '../../../src/actions/domain/types/SendEmail.js';
import { Action, ActionTypes } from '../../../src/actions/index.js';
import { Template } from '../../../src/templates/index.js';
import { MailAccount } from '../../../src/mail-accounts/index.js';
import { Case } from '../../../src/cases/index.js';
import ActionMother from '../domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import TemplatesMother from '../../templates/domain/TemplatesMother.js';
import MailAccountMother from '../../mail-accounts/domain/MailAccountMother.js';
import { Helper } from '../../../src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';

const findByIdRepository = (entity) => ({
    find: jest.fn(async () => entity),
    connection: () => {},
});

const nullRepository = () => ({
    find: jest.fn(async () => null),
});

const createSendEmail = ({
    template,
    mailAccount,
    caseAttachments = [],
    reader,
    emailService,
    eventLogger,
    inlineImageEmbedder,
    templateAttachmentEmbedder,
}) =>
    new SendEmail(
        findByIdRepository(template),
        findByIdRepository(mailAccount),
        nullRepository(),
        nullRepository(),
        nullRepository(),
        nullRepository(),
        nullRepository(),
        nullRepository(),
        {
            findActiveByCaseId: jest.fn(async () => caseAttachments),
        },
        reader,
        emailService,
        eventLogger,
        /* stateRepository */ undefined,
        /* transitionRepository */ undefined,
        inlineImageEmbedder,
        templateAttachmentEmbedder
    );

describe('SendEmail case attachments', () => {
    beforeEach(() => {
        jest.spyOn(Helper, 'logError').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('attaches active case attachments when the template flag is enabled and entity is a Case', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const caseAttachment = {
            path: { value: 'evidence.txt' },
            description: { value: 'text/plain' },
            type: { value: 2 },
        };
        const attachmentContent = {
            filename: 'evidence.txt',
            contentType: 'text/plain',
            content: Buffer.from('evidence'),
        };
        const reader = {
            read: jest.fn(async () => attachmentContent),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            caseAttachments: [caseAttachment],
            reader,
            emailService,
            eventLogger,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(reader.read).toHaveBeenCalledWith({
            caseId: kase.id.value,
            filename: 'evidence.txt',
            contentType: 'text/plain',
        });
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.attachments.value).toEqual([attachmentContent]);
        expect(eventLogger.log).toHaveBeenCalledWith(
            'action.executed',
            action.id.value,
            kase.created_by.value,
            expect.objectContaining({ success: true }),
            kase.id.value,
            kase.cliente_id.value,
            expect.any(Object)
        );
    });

    it('fails the send action when an enabled case attachment cannot be read', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const reader = {
            read: jest.fn(async () => {
                throw new Error('missing_s3_object');
            }),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            caseAttachments: [
                { path: { value: 'missing.txt' }, description: { value: 'text/plain' }, type: { value: 2 } },
            ],
            reader,
            emailService,
            eventLogger,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(false);
        expect(emailService.execute).not.toHaveBeenCalled();
        expect(eventLogger.log).toHaveBeenCalledWith(
            'action.executed',
            action.id.value,
            kase.created_by.value,
            expect.objectContaining({ success: false }),
            kase.id.value,
            kase.cliente_id.value,
            expect.any(Object)
        );
    });

    it('attaches only the ENVIO attachments when the case mixes ENVIO and RECEPCION types', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const envioContent = {
            filename: 'foto_envio.png',
            contentType: 'image/png',
            content: Buffer.from('envio'),
        };
        const reader = {
            read: jest.fn(async () => envioContent),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            caseAttachments: [
                { path: { value: 'foto_envio.png' }, description: { value: 'image/png' }, type: { value: 2 } },
                {
                    path: { value: 'evidencia_recepcion.pdf' },
                    description: { value: 'application/pdf' },
                    type: { value: 1 },
                },
            ],
            reader,
            emailService,
            eventLogger,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(reader.read).toHaveBeenCalledTimes(1);
        expect(reader.read).toHaveBeenCalledWith({
            caseId: kase.id.value,
            filename: 'foto_envio.png',
            contentType: 'image/png',
        });
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.attachments.value).toEqual([envioContent]);
    });

    it('sends without attachments when the case only has RECEPCION or untyped attachments', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const reader = {
            read: jest.fn(),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            caseAttachments: [
                { path: { value: 'recepcion.jpg' }, description: { value: 'image/jpeg' }, type: { value: 1 } },
                { path: { value: 'sin_tipo.pdf' }, description: { value: 'application/pdf' }, type: { value: null } },
            ],
            reader,
            emailService,
            eventLogger,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(reader.read).not.toHaveBeenCalled();
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.attachments.value).toEqual([]);
    });

    it('sends without attachments when the flag is enabled but the Case has no active attachments', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const reader = {
            read: jest.fn(),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            caseAttachments: [],
            reader,
            emailService,
            eventLogger,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(reader.read).not.toHaveBeenCalled();
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.attachments.value).toEqual([]);
    });

    it('ignores the flag outside Case context', async () => {
        const entity = {
            id: { value: uuidv4() },
            created_by: { value: uuidv4() },
            updated_by: { value: null },
            toJson: () => ({ id: 'entity' }),
        };
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                enviar_adjuntos_del_caso: true,
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const caseAttachmentRepository = {
            findActiveByCaseId: jest.fn(async () => {
                throw new Error('should_not_query_case_attachments');
            }),
        };
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                entity: 'user',
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = new SendEmail(
            findByIdRepository(template),
            findByIdRepository(mailAccount),
            nullRepository(),
            nullRepository(),
            nullRepository(),
            nullRepository(),
            nullRepository(),
            nullRepository(),
            caseAttachmentRepository,
            { read: jest.fn() },
            emailService,
            eventLogger
        );

        const result = await sendEmail.execute(entity, action, 'editar_usuario');

        expect(result).toBe(true);
        expect(caseAttachmentRepository.findActiveByCaseId).not.toHaveBeenCalled();
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.attachments.value).toEqual([]);
    });

    it('embeds template inline images as base64 before sending', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                cuerpo: '<p>Hola</p><img src="https://bucket.s3.amazonaws.com/logo.png?X-Amz-Expires=604800">',
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const inlineImageEmbedder = {
            execute: jest.fn(async (html) =>
                html.replace(
                    '<img src="https://bucket.s3.amazonaws.com/logo.png?X-Amz-Expires=604800" />',
                    '<img src="data:image/png;base64,ZmFrZQ==">'
                )
            ),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            reader: { read: jest.fn() },
            emailService,
            eventLogger,
            inlineImageEmbedder,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(inlineImageEmbedder.execute).toHaveBeenCalledWith(
            '<p>Hola</p><img src="https://bucket.s3.amazonaws.com/logo.png?X-Amz-Expires=604800" />'
        );
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.content.value).toBe('<p>Hola</p><img src="data:image/png;base64,ZmFrZQ==" />');
    });

    it('resolves template-attachment placeholders before the generic external-URL embedder runs', async () => {
        const kase = Case.create(CasesMother.dto());
        const template = Template.create(
            TemplatesMother.dto({
                destinatario: 'customer@example.com',
                cuerpo: '<img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png">',
            })
        );
        const mailAccount = await MailAccount.create(MailAccountMother.dto({ type: 'smtp' }));
        const emailService = {
            execute: jest.fn(async () => 'sent'),
        };
        const eventLogger = {
            log: jest.fn(async () => {}),
        };
        const templateAttachmentEmbedder = {
            execute: jest.fn(async () => '<img src="data:image/png;base64,dGVtcGxhdGU=">'),
        };
        const inlineImageEmbedder = {
            execute: jest.fn(async (html) => html),
        };
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ENVIO_CORREO.value,
                template_id: template.id.value,
                mail_account_id: mailAccount.id.value,
            })
        );
        const sendEmail = createSendEmail({
            template,
            mailAccount,
            reader: { read: jest.fn() },
            emailService,
            eventLogger,
            inlineImageEmbedder,
            templateAttachmentEmbedder,
        });

        const result = await sendEmail.execute(kase, action, 'editar_caso');

        expect(result).toBe(true);
        expect(templateAttachmentEmbedder.execute).toHaveBeenCalledWith(
            '<img src="template-attachment://tmpl-1" data-filename="logo.png" data-mime="image/png" />',
            { templateId: template.id.value }
        );
        expect(inlineImageEmbedder.execute).toHaveBeenCalledWith('<img src="data:image/png;base64,dGVtcGxhdGU=">');
        const [mail] = emailService.execute.mock.calls[0];
        expect(mail.content.value).toBe('<img src="data:image/png;base64,dGVtcGxhdGU=" />');
    });
});
