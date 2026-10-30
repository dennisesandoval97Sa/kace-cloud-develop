export class TemplateAttachmentResponse {
    /** @type {templateAttachment} is initialized in the constructor */
    #templateAttachment;

    /**
     * Creates an instance of templateAttachmentResponse.
     *
     * @param {templateAttachment} templateAttachment - The templateAttachment instance.
     */
    constructor(templateAttachment) {
        this.#templateAttachment = templateAttachment;
    }

    /**
     * Converts the templateAttachment object to a JSON representation.
     *
     * @returns {Object} A flat object containing the templateAttachment data.
     */
    toJson() {
        if (!this.#templateAttachment) return {};

        return {
            data: {
                id: this.#templateAttachment.id.value,
                template_id: this.#templateAttachment.template_id.value,
                path: this.#templateAttachment.path.value,
                type: this.#templateAttachment.type.value,
                is_active: this.#templateAttachment.is_active.value,
                created_at: this.#templateAttachment.created_at.value,
                created_by: this.#templateAttachment.created_by.value,
                updated_at: this.#templateAttachment.updated_at.value,
                updated_by: this.#templateAttachment.updated_by.value,
            },
        };
    }
}
