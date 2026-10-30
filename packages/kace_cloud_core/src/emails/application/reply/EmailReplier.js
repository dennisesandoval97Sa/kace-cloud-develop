import { v4 as uuidv4 } from 'uuid';
import { CHANNEL_HUB_REPLY_REJECTED } from '@kace/error-codes';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { channelHubRejectionError, isChannelHubRejection } from '../../domain/services/ChannelHubRejection.js';
import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import {
    buildEmailTemplateContext,
    replaceTemplateVariables,
    renderRecipientList,
} from '../../../shared/domain/services/emailTemplating/emailTemplatesUtils.js';
import { ChannelHubEmailPayloadBuilder } from '../../infrastructure/mappers/ChannelHubEmailPayloadBuilder.js';
import { Email } from '../../domain/Email.js';
import { EmailBody } from '../../domain/EmailBody.js';

export class EmailReplier {
    #emailRepository;
    #emailBodyRepository;
    #attachmentPersister;
    #channelHubAccountRepository;
    #interactionRepository;
    #caseRepository;
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

        const renderedReplyMessage = replaceTemplateVariables(dto.reply_message_to_send, context);

        let renderedCc, renderedBcc;
        try {
            renderedCc = renderRecipientList('cc', dto.cc, context);
            renderedBcc = renderRecipientList('bcc', dto.bcc, context);
        } catch (error) {
            if (error instanceof InvalidArgumentError) {
                throw new CustomError(error.message, 422);
            }
            throw error;
        }

        // Validates attachments exist in storage before sending; persisted after the send succeeds.
        const preparedAttachments = await this.#attachmentPersister.prepare(dto.attachments ?? []);

        const payload = ChannelHubEmailPayloadBuilder.buildReplyPayload({
            connectionId,
            from: dto.from,
            inReplyTo: dto.in_reply_to,
            replyMessage: renderedReplyMessage,
            isReplyAll: dto.is_reply_all,
            cc: renderedCc,
            bcc: renderedBcc,
            attachments: dto.attachments ?? [],
        });

        let response;
        try {
            response = await this.#workflowExecutor.execute({
                external_code: 'channelhub-reply-email',
                initial_context: { channel_hub: payload },
            });
        } catch (err) {
            throw new CustomError(err?.message ?? 'Channel Hub request failed', 400);
        }

        const replyResp = response.toJson()?.data?.context?.channel_hub?.reply_response;
        if (!replyResp?.messageId) {
            if (isChannelHubRejection(replyResp)) {
                throw channelHubRejectionError(replyResp, CHANNEL_HUB_REPLY_REJECTED);
            }
            throw new CustomError('Channel Hub rejected the reply', 502);
        }

        const channelHubMessageId = replyResp.messageId;
        const threadId = replyResp?.threadId ?? null;
        const subject = replyResp?.subject ?? null;
        const destination = replyResp?.destination ?? {};

        const interaction = await this.#interactionRepository.find(new ValueObjectUuid('id', dto.interaction_id));
        const workspace_id = interaction.workspace_id.value;

        const now = new Date();
        const emailId = uuidv4();

        const email = new Email({
            id: emailId,
            s3_key: null,
            subject,
            sender: dto.from,
            to: this.#normalizeRecipientList(destination.to),
            cc: this.#normalizeRecipientList(destination.cc),
            bcc: this.#normalizeRecipientList(destination.bcc),
            priority: 'normal',
            workspace_id,
            message_id: channelHubMessageId,
            thread_id: threadId,
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
            body: renderedReplyMessage,
            body_html: renderedReplyMessage,
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

    #normalizeRecipientList(value) {
        const values = Array.isArray(value) ? value : value ? [value] : [];

        return values
            .flatMap((recipient) => {
                if (typeof recipient === 'string') {
                    return recipient
                        .split(',')
                        .map((email) => email.trim())
                        .filter(Boolean)
                        .map((email) => ({ email, name: null }));
                }

                const email = recipient?.email ?? recipient?.address ?? null;
                return email ? [{ email, name: recipient?.name ?? null }] : [];
            })
            .filter((recipient) => Boolean(recipient.email));
    }
}
