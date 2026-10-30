import { Action } from '../../domain/Action.js';
import { Case } from '../../../cases/index.js';
import { EmailService, Mail } from '../../../mails/index.js';
import { CaseAttachmentTypeEnum, Helper, InvalidArgumentError } from '../../../shared/index.js';
import { MailAccountFinder } from '../../../mail-accounts/domain/MailAccountFinder.js';
import { Template } from '../../../templates/index.js';
import { TemplateFinder } from '../../../templates/domain/TemplateFinder.js';
import { ClientFinder } from '../../../clients/index.js';
import { UserFinder } from '../../../users/domain/UserFinder.js';
import { ClassificationFinder } from '../../../classifications/index.js';
import { AuxCasesFinder } from '../../../aux_casos/index.js';
import { AuxClientsFinder } from '../../../aux_clientes/index.js';
import { buildEmailTemplateContext, replaceTemplateVariables, renderEmailsOrFail } from './emailTemplatesUtils.js';
import { StateFinder } from '../../../state/application/find/StateFinder.js';
import { TransitionsFinder } from '../../../transition/domain/TransitionsFinder.js';
import { ActionTypes } from '../ActionTypes.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { S3CaseAttachmentReader } from '../../../case-attachments/index.js';
import { ChannelHubInlineImageEmbedder } from '../../../channel-hub-inbound-emails/application/ChannelHubInlineImageEmbedder.js';
import { ChannelHubInboundAttachmentDownloader } from '../../../channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js';
import {
    S3TemplateAttachmentReader,
    TemplateAttachmentInlineImageEmbedder,
} from '../../../template-attachments/index.js';

export class SendEmail {
    static ACTION_TYPE = ActionTypes.ENVIO_CORREO.value;

    /** @type {EmailService} is initialized in the constructor */
    #emailService;

    /**
     *
     * @param {KnexTemplatesRepository} templatesRepository
     * @param {KnexMailAccountRepository} mailAccountRepository
     * @param {KnexClientRepository} clientRepository
     * @param {KnexUserRepository} userRepository
     * @param {KnexClassificationRepository} classificationRepository
     */
    constructor(
        templatesRepository,
        mailAccountRepository,
        clientRepository,
        userRepository,
        classificationRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretRepository,
        caseAttachmentRepository = null,
        caseAttachmentReader = new S3CaseAttachmentReader(),
        emailService = new EmailService(secretRepository),
        eventLogger = new EventLogger(templatesRepository),
        stateRepository = null,
        transitionRepository = null,
        inlineImageEmbedder = new ChannelHubInlineImageEmbedder({
            downloader: new ChannelHubInboundAttachmentDownloader(),
        }),
        templateAttachmentEmbedder = new TemplateAttachmentInlineImageEmbedder({
            reader: new S3TemplateAttachmentReader(),
        }),
        templateAttachmentRepository = null,
        templateAttachmentReader = new S3TemplateAttachmentReader()
    ) {
        this.templateFinder = new TemplateFinder(templatesRepository);
        this.mailAccountFinder = new MailAccountFinder(mailAccountRepository);
        this.clientFinder = new ClientFinder(clientRepository);
        this.userFinder = new UserFinder(userRepository);
        this.classificationFinder = new ClassificationFinder(classificationRepository);
        this.auxCasesFinder = new AuxCasesFinder(auxCasesRepository);
        this.auxClientsFinder = new AuxClientsFinder(auxClientsRepository);
        this.stateFinder = stateRepository ? new StateFinder(stateRepository) : null;
        this.transitionFinder = transitionRepository ? new TransitionsFinder(transitionRepository) : null;
        this.eventLogger = eventLogger;
        this.#emailService = emailService;
        this.caseAttachmentRepository = caseAttachmentRepository;
        this.caseAttachmentReader = caseAttachmentReader;
        this.inlineImageEmbedder = inlineImageEmbedder;
        this.templateAttachmentEmbedder = templateAttachmentEmbedder;
        this.templateAttachmentRepository = templateAttachmentRepository;
        this.templateAttachmentReader = templateAttachmentReader;
    }

    async execute(entity, action, trigger) {
        let result = false;
        let currentAdvisorId;
        let originalValues;

        try {
            if (action.entity && action.entity.value === 'case' && !(entity instanceof Case)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Case".');
            }
            currentAdvisorId = entity.updated_by.value || entity.created_by.value;
            originalValues = entity.toJson();

            if (!(action instanceof Action)) {
                throw new InvalidArgumentError('The provided entity is not a valid instance of "Action".');
            }
            const template = await this.templateFinder.execute(action.template_id.value);
            if (!template || !(template instanceof Template)) {
                throw new Error(`Template with ID ${action.template_id.value} not found.`);
            }
            const mailAccount = await this.mailAccountFinder.execute(action.mail_account_id.value);
            if (!mailAccount) {
                throw new Error(`Mail Account with ID ${action.mail_account_id.value} not found.`);
            }
            const context = await buildEmailTemplateContext({
                entity,
                clientFinder: this.clientFinder,
                userFinder: this.userFinder,
                classificationFinder: this.classificationFinder,
                auxCasesFinder: this.auxCasesFinder,
                auxClientsFinder: this.auxClientsFinder,
                stateFinder: this.stateFinder,
                transitionFinder: this.transitionFinder,
            });

            const renderedBody = replaceTemplateVariables(template.cuerpo.value, context);
            const bodyWithTemplateImages = await this.templateAttachmentEmbedder.execute(renderedBody, {
                templateId: action.template_id.value,
            });
            const mailDto = {
                id: mailAccount.id.value,
                mail_account_id: mailAccount.id.value,
                to: renderEmailsOrFail('destinatario', template.destinatario.value, context),
                subject: replaceTemplateVariables(template.asunto.value, context),
                content: await this.inlineImageEmbedder.execute(bodyWithTemplateImages),
                attachments: [
                    ...(await this.#buildCaseAttachments(entity, template)),
                    ...(await this.#buildTemplateAttachments(template)),
                ],
                sent_status: 'PENDING',
                created_at: new Date(),
                created_by: entity.created_by.value,
            };

            if (template.copia.value) {
                mailDto.cc = renderEmailsOrFail('copia', template.copia.value, context);
            }
            if (template.copia_oculta.value) {
                mailDto.bcc = renderEmailsOrFail('copia_oculta', template.copia_oculta.value, context);
            }

            const mail = Mail.create(mailDto);

            const emailResult = await this.#emailService.execute(mail, mailAccount);
            if (emailResult !== 'failed') {
                result = true;
            }
        } catch (error) {
            Helper.logError('Error al enviar correo:', error);
        }

        await this.#logEvent({
            success: result,
            aggregateId: action?.id?.value,
            description: action?.description?.value,
            trigger,
            currentUserId: currentAdvisorId,
            entity,
            originalValues,
        });

        return result;
    }

    async #buildCaseAttachments(entity, template) {
        if (!(entity instanceof Case)) return [];
        if (template.enviar_adjuntos_del_caso?.value !== true) return [];
        if (!this.caseAttachmentRepository || !this.caseAttachmentReader) return [];

        const attachments = await this.caseAttachmentRepository.findActiveByCaseId(entity.id.value);
        const sendableAttachments = attachments.filter(
            (attachment) => attachment.type?.value === CaseAttachmentTypeEnum.ENVIO.value
        );
        if (!sendableAttachments.length) return [];

        return Promise.all(
            sendableAttachments.map((attachment) =>
                this.caseAttachmentReader.read({
                    caseId: entity.id.value,
                    filename: attachment.path.value,
                    contentType: attachment.description.value,
                })
            )
        );
    }

    /**
     * Real (non-inline) file attachments uploaded via the template's "Includes
     * Attachments" toggle - distinct from the `template-attachment://` images
     * referenced inline in the body, which templateAttachmentEmbedder already
     * handles. Previously `template.incluye_adjuntos` was never read anywhere in
     * the send flow, so these files were saved and listed in the UI but never
     * actually attached to the sent email.
     */
    async #buildTemplateAttachments(template) {
        if (template.incluye_adjuntos?.value !== true) return [];
        if (!this.templateAttachmentRepository || !this.templateAttachmentReader) return [];

        const attachments = await this.templateAttachmentRepository.findActiveByTemplateId(template.id.value);
        if (!attachments.length) return [];

        return Promise.all(
            attachments.map((attachment) =>
                this.templateAttachmentReader.read({
                    templateId: template.id.value,
                    filename: attachment.path.value,
                    contentType: attachment.type.value,
                })
            )
        );
    }

    async #logEvent({ success, aggregateId, description, currentUserId, entity, originalValues, trigger }) {
        if (!aggregateId || !currentUserId) return;

        const eventBody = {
            description,
            actionType: SendEmail.ACTION_TYPE,
            trigger,
            success,
        };

        const oldData = {
            responsable_id: originalValues?.responsable_id,
            grupo_id: originalValues?.grupo_id,
            transicion_id: originalValues?.transicion_id,
        };

        await this.eventLogger.log(
            'action.executed',
            aggregateId,
            currentUserId,
            eventBody,
            entity.id.value,
            entity.cliente_id?.value || null,
            oldData
        );
    }
}
