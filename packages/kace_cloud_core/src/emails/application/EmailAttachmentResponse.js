import { EmailAttachment } from '../domain/EmailAttachments';

export class EmailAttachmentResponse {
    /** @type {EmailAttachment} */
    #attachment;

    constructor(attachment) {
        this.#attachment = attachment;
    }

    /**
     * Converts the EmailAttachment object to JSON representation.
     * @returns {Object}
     */
    toJson() {
        if (!this.#attachment) return {};

        return {
            data: {
                id: this.#attachment.id.value,
                email_id: this.#attachment.email_id.value,
                url: this.#attachment.url.value,
                size: this.#attachment.size.value,
                filename: this.#attachment.filename.value,
                name: this.#attachment.filename.value,

                created_at: this.#attachment.created_at?.value ?? null,
                created_by: this.#attachment.created_by?.value ?? null,
                updated_at: this.#attachment.updated_at?.value ?? null,
                updated_by: this.#attachment.updated_by?.value ?? null,
            },
        };
    }
}
