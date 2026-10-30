import { v4 as uuid } from 'uuid';

/**
 * Mapper that receives the raw payload from the webhook and transforms it
 * into the DTOs expected by the Email and Interaction Aggregates.
 */
export class WebhookMapper {
    /**
     * Map the payload to a valid DTO for EmailCreator.
     */
    static toEmailDTO(payload, workSpaceID) {
        const destination = payload.destination ?? {};
        const content = payload.content ?? {};

        const normalizeRecipients = (value) => {
            if (!value) return [];
            return Array.isArray(value) ? value : [value];
        };

        return {
            id: uuid(),
            s3_key: payload.s3_key ?? null,
            subject: payload.subject ?? null,
            sender: payload.origin ?? null,

            to: normalizeRecipients(destination.to),
            cc: normalizeRecipients(destination.cc),
            bcc: normalizeRecipients(destination.bcc),

            priority: payload.priority ?? 'low',

            workspace_id: workSpaceID ?? null,
            message_id: payload.messageIdOperator ?? payload.messageId ?? uuid(),
            received_at: payload.received_at ?? new Date(),

            body: {
                body: content.text ?? null,
            },
            attachments: payload.attachments ?? [],

            created_at: payload.created_at ?? new Date(),
            created_by: payload.created_by ?? null,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Maps to DTO for InteractionCreator.
     */
    static toInteractionDTO(payload) {
        return {
            id: uuid(),
            channel_id: payload.channel_id ?? null,
            client_identifier: payload.client_identifier ?? null,
            external_identifier: payload.external_identifier ?? null,
            description: payload.description ?? null,

            priority: payload.priority ?? 'normal',
            is_closed: false,

            start_review_at: null,
            start_review_by: null,

            workspace_id: payload.workspace_id ?? null,
            conversation_id: payload.conversation_id ?? null,

            created_at: payload.created_at ?? new Date(),
            created_by: payload.created_by ?? null,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Map the email "body" if it exists
     * EmailBodyCreator expects a DTO with the email_id appended.
     */
    static toEmailBodyDTO(payload, emailId) {
        if (!payload.body) return null;

        return {
            id: uuid(),
            email_id: emailId,
            body: payload.body,
            created_at: payload.created_at ?? new Date(),
            created_by: payload.created_by ?? null,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Map attachments if they come.
     */
    static toAttachmentDTOs(payload, emailId) {
        if (!payload.attachments?.length) return [];

        return payload.attachments.map((att) => ({
            id: uuid(),
            email_id: emailId,
            url: att.url ?? null,
            size: att.size ?? null,
            created_at: payload.created_at ?? new Date(),
            created_by: payload.created_by ?? null,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        }));
    }
}
