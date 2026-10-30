import { v4 as uuidv4 } from 'uuid';
import { CHANNEL_HUB_SEND_REJECTED } from '@kace/error-codes';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { channelHubRejectionError, isChannelHubRejection } from '../../domain/services/ChannelHubRejection.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import {
    buildEmailTemplateContext,
    replaceTemplateVariables,
    renderRecipientList,
} from '../../../shared/domain/services/emailTemplating/emailTemplatesUtils.js';
import { ChannelHubEmailPayloadBuilder } from '../../infrastructure/mappers/ChannelHubEmailPayloadBuilder.js';
import { Email } from '../../domain/Email.js';
import { EmailBody } from '../../domain/EmailBody.js';

export class EmailSender {
    #emailRepository;
    #emailBodyRepository;
    #attachmentPersister;
    #channelHubAccountRepository;
    #interactionRepository;
    #caseRepository;
    #workspaceRepository;
    #workflowExecutor;
    #clientFinder;
    #userFinder;
    #classificationFinder;
    #auxCasesFinder;
    #auxClientsFinder;

    constructor({
        emailRepository,
        emailBodyRepository,
        attachmentPersister,
        channelHubAccountRepository,
        interactionRepository,
        caseRepository,
        workspaceRepository,
        workflowExecutor,
        clientFinder,
        userFinder,
        classificationFinder,
        auxCasesFinder,
        auxClientsFinder,
    }) {
        this.#emailRepository = emailRepository;
        this.#emailBodyRepository = emailBodyRepository;
        this.#attachmentPersister = attachmentPersister;
        this.#channelHubAccountRepository = channelHubAccountRepository;
        this.#interactionRepository = interactionRepository;
        this.#caseRepository = caseRepository;
        this.#workspaceRepository = workspaceRepository;
        this.#workflowExecutor = workflowExecutor;
        this.#clientFinder = clientFinder;
        this.#userFinder = userFinder;
        this.#classificationFinder = classificationFinder;
        this.#auxCasesFinder = auxCasesFinder;
        this.#auxClientsFinder = auxClientsFinder;
    }

    async execute(dto, userId) {
        const caseEntity = await this.#caseRepository.find(new ValueObjectUuid('case_id', dto.case_id));
        if (!caseEntity) {
            throw new CustomError('Case not found for this case_id', 422);
        }

        const account = await this.#channelHubAccountRepository.findByEmail(dto.from);
        if (!account) {
            throw new CustomError('No Channel Hub account found for this from address', 422);
        }

        const connectionId = account.channel_hub_connection_id.value;
        const accountId = account.id.value;

        const context = await buildEmailTemplateContext({
            entity: caseEntity,
            clientFinder: this.#clientFinder,
            userFinder: this.#userFinder,
            classificationFinder: this.#classificationFinder,
            auxCasesFinder: this.#auxCasesFinder,
            auxClientsFinder: this.#auxClientsFinder,
        });

        let renderedTo, renderedCc, renderedBcc;
        try {
            renderedTo = renderRecipientList('to', dto.to, context);
            renderedCc = renderRecipientList('cc', dto.cc, context);
            renderedBcc = renderRecipientList('bcc', dto.bcc, context);
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                throw new CustomError(error.message, 422);
            }
            throw error;
        }

        const renderedSubject = replaceTemplateVariables(dto.subject, context);
        const renderedHtml = replaceTemplateVariables(dto.message_to_send, context);

        // Validates attachments exist in storage before sending; persisted after the send succeeds.
        const preparedAttachments = await this.#attachmentPersister.prepare(dto.attachments ?? []);

        const payload = ChannelHubEmailPayloadBuilder.buildSendPayload({
            connectionId,
            from: dto.from,
            to: renderedTo,
            cc: renderedCc,
            bcc: renderedBcc,
            subject: renderedSubject,
            html: renderedHtml,
            attachments: dto.attachments ?? [],
        });

        let response;
        try {
            response = await this.#workflowExecutor.execute({
                external_code: 'channelhub-send-email',
                initial_context: { channel_hub: payload },
            });
        } catch (err) {
            throw new CustomError(err?.message ?? 'Channel Hub request failed', 400);
        }

        const sendResp = response.toJson()?.data?.context?.channel_hub?.send_response;
        if (!sendResp?.messageId) {
            if (isChannelHubRejection(sendResp)) {
                throw channelHubRejectionError(sendResp, CHANNEL_HUB_SEND_REJECTED);
            }
            throw new CustomError('Channel Hub rejected the send', 502);
        }

        const channelHubMessageId = sendResp.messageId;

        const workspace_id = await this.#resolveWorkspaceId(dto.interaction_id);

        const now = new Date();
        const emailId = uuidv4();

        const email = new Email({
            id: emailId,
            s3_key: null,
            subject: renderedSubject,
            sender: dto.from,
            to: renderedTo,
            cc: renderedCc,
            bcc: renderedBcc,
            priority: 'normal',
            workspace_id,
            message_id: channelHubMessageId,
            account_id: accountId,
            received_at: now,
            case_id_outbound: caseEntity.id.value,
            case_reference_outbound: caseEntity.reference?.value ?? null,
            is_outbound: true,
            created_at: now,
            created_by: userId,
            updated_at: now,
            updated_by: userId,
        });

        await this.#emailRepository.save(email);

        const emailBody = EmailBody.create({
            email_id: emailId,
            body: renderedHtml,
            body_html: renderedHtml,
            created_at: now,
            created_by: userId,
            updated_at: now,
            updated_by: userId,
        });

        await this.#emailBodyRepository.save(emailBody);

        await this.#attachmentPersister.persist({
            emailId,
            attachments: preparedAttachments,
            userId,
            now,
        });

        return { id: emailId };
    }

    /**
     * Resolves the workspace for the outbound email. When an interaction_id is provided
     * and found, its workspace is used. Otherwise (no interaction_id, or interaction not
     * found) it falls back to the default INBOX workspace, mirroring the inbound flow
     * (ChannelHubInboundEmailProcessor).
     *
     * @param {string|null|undefined} interactionId
     * @returns {Promise<string>}
     */
    async #resolveWorkspaceId(interactionId) {
        if (interactionId) {
            const interaction = await this.#interactionRepository.find(new ValueObjectUuid('id', interactionId));
            if (interaction) {
                return interaction.workspace_id.value;
            }
        }

        const inboxWorkspace = await this.#workspaceRepository.findDefaultInboxWorkspace();
        if (!inboxWorkspace) {
            throw new CustomError('Default INBOX Workspace is not configured or inactive.', 422);
        }

        return inboxWorkspace.id.value;
    }
}
