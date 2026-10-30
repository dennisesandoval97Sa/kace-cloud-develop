import { CustomError } from '@kace/core/src/shared';
import { EmailFinder as DomainEmailFinder } from '../../domain/EmailFinder';
import { EmailBodyFinder } from '../../domain/EmailBodyFinder';
import { buildEmailBodyPayload } from '../EmailBodyResponsePayload.js';
import { EmailAttachmentS3Location } from '../../domain/EmailAttachmentS3Location.js';

export class EmailDetailFinder {
    #finder;
    #emailBodyFinder;
    #attachmentsRepository;
    #interactionRepository;
    #interactionCasoRepo;
    #caseRepository;
    #channelHubAccountRepository;
    #workspaceRepository;

    constructor(
        emailRepository,
        emailBodyRepository,
        attachmentsRepository,
        interactionRepository,
        interactionCasoRepo,
        caseRepository,
        channelHubAccountRepository,
        workspaceRepository
    ) {
        this.#finder = new DomainEmailFinder(emailRepository);
        this.#emailBodyFinder = new EmailBodyFinder(emailBodyRepository);
        this.#attachmentsRepository = attachmentsRepository;
        this.#interactionRepository = interactionRepository;
        this.#interactionCasoRepo = interactionCasoRepo;
        this.#caseRepository = caseRepository;
        this.#channelHubAccountRepository = channelHubAccountRepository;
        this.#workspaceRepository = workspaceRepository;
    }

    async execute(emailId) {
        const email = await this.#finder.execute(emailId);
        if (!email || email.isDeleted()) {
            throw new CustomError('Email not found', 404);
        }

        const id = email.id.value;

        const [body, attachments, interaction, account] = await Promise.all([
            this.#emailBodyFinder.execute(id),
            this.#attachmentsRepository.findAllByEmailId(id),
            this.#interactionRepository.findByEmailId(id),
            this.#channelHubAccountRepository.find(email.account_id),
        ]);

        let interactionPayload = null;
        let cases = [];

        if (interaction) {
            const [pivotRows, workspace] = await Promise.all([
                this.#interactionCasoRepo.findByInteractionId(interaction.id.value),
                this.#workspaceRepository.find(interaction.workspace_id),
            ]);

            const caseIds = pivotRows.map((row) => row.caso_id);

            if (caseIds.length > 0) {
                const caseRows = await this.#caseRepository.findSummaryByIds(caseIds);
                cases = caseRows.map((c) => ({
                    id: c.id,
                    external_code: c.external_code ?? null,
                    reference: c.reference ?? null,
                    created_at: c.created_at ?? null,
                }));
            }

            interactionPayload = {
                id: interaction.id.value,
                workspace_id: interaction.workspace_id.value,
                workspace_name: workspace?.description?.value ?? null,
                tag: workspace?.tag?.value ?? null,
                is_closed: interaction.is_closed.value,
                in_review: interaction.in_review.value,
                is_migrated: interaction.is_migrated.value,
                priority: interaction.priority.value,
                created_at: interaction.created_at?.value ?? null,
            };
        }

        const flatEmails = (list) => (list ?? []).map((r) => r?.email ?? r);

        return {
            id,
            email_account: account?.email?.value ?? null,
            channel_hub_message_id: email.message_id.value,
            thread_id: email.thread_id.value,
            subject: email.subject.value,
            sender: email.sender.value,
            to: flatEmails(email.to.value),
            cc: flatEmails(email.cc.value),
            bcc: flatEmails(email.bcc.value),
            received_at: email.received_at.value,
            workspace_id: email.workspace_id.value,
            case_id_outbound: email.case_id_outbound.value,
            case_reference_outbound: email.case_reference_outbound.value,
            is_outbound: email.is_outbound.value,
            body: buildEmailBodyPayload(body),
            // id/filename are derived from the URL per the POST /download-s3-files
            // contract: id is the S3 folder id (NOT the attachment row id — the email id
            // for inbound, the upload-flow folder for outbound); null for legacy URLs.
            attachments: (attachments ?? []).map((att) => {
                const location = EmailAttachmentS3Location.fromUrl(att.url.value);
                return {
                    id: location?.folderId ?? null,
                    url: att.url.value,
                    filename: location?.basename ?? null,
                    size: att.size.value,
                };
            }),
            interaction: interactionPayload,
            cases,
        };
    }
}
