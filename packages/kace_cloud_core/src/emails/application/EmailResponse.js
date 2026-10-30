import { Email } from '../domain/Email';
import { EmailAttachment } from '../domain/EmailAttachments';
import { EmailBody } from '../domain/EmailBody';
import { buildEmailBodyPayload } from './EmailBodyResponsePayload.js';

export class EmailResponse {
    /** @type {Email} is initialized in the constructor */
    #email;
    /** @type {EmailBody} is initialized in the constructor */
    #body;
    /** @type {EmailAttachment} is initialized in the constructor */
    #attachments;

    constructor(email, body, attachment) {
        this.#email = email;
        this.#body = body;
        this.#attachments = attachment;
    }

    /**
     * Converts the Email object to  JSON representation.
     * @returns {Object} A plain object containing the Email data.
     */
    toJson() {
        if (!this.#email) return {};
        const attachments = this.#attachments ?? [];
        return {
            data: {
                id: this.#email.id.value,
                s3_key: this.#email.s3_key.value,
                subject: this.#email.subject.value,
                sender: this.#email.sender.value,
                to: this.#email.to.value,
                cc: this.#email.cc.value,
                bcc: this.#email.bcc.value,
                priority: this.#email.priority.value,
                workspace_id: this.#email.workspace_id.value,
                message_id: this.#email.message_id.value,
                thread_id: this.#email.thread_id.value,
                account_id: this.#email.account_id.value,
                received_at: this.#email.received_at.value,
                is_outbound: this.#email.is_outbound.value,

                created_at: this.#email.created_at.value,
                created_by: this.#email.created_by.value,
                updated_at: this.#email.updated_at.value,
                updated_by: this.#email.updated_by.value,

                body: buildEmailBodyPayload(this.#body),
                attachments: attachments.map((att) => ({
                    id: att.id.value,
                    email_id: att.email_id.value,
                    url: att.url.value,
                    size: att.size.value,
                    filename: att.filename.value,
                    name: att.filename.value,
                    created_at: att.created_at.value,
                    created_by: att.created_by.value,
                    updated_at: att.updated_at.value,
                    updated_by: att.updated_by.value,
                })),
            },
        };
    }
}
