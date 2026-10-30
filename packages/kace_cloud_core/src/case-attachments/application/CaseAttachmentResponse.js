export class CaseAttachmentResponse {
    /**
     * @type {CaseAttachment}
     * is initialized in the constructor.
     */
    #caseAttachment;

    /**
     * Creates an instance of CaseAttachmentResponse.
     *
     * @param {CaseAttachment} caseAttachment - The CaseAttachment instance.
     */
    constructor(caseAttachment) {
        this.#caseAttachment = caseAttachment;
    }

    /**
     * Converts the CaseAttachment object to a JSON representation.
     *
     * @returns {Object} A flat object containing the CaseAttachment data.
     */
    toJson() {
        if (!this.#caseAttachment) return {};

        return {
            data: {
                id: this.#caseAttachment.id.value,
                case_id: this.#caseAttachment.case_id.value,
                description: this.#caseAttachment.description.value,
                size: this.#caseAttachment.size.value,
                path: this.#caseAttachment.path.value,
                type: this.#caseAttachment.type.value,
                is_active: this.#caseAttachment.is_active.value,
                attachment_type: this.#caseAttachment.attachment_type ?? null,
                created_at: this.#caseAttachment.created_at.value,
                created_by: this.#caseAttachment.created_by.value,
                updated_at: this.#caseAttachment.updated_at.value,
                updated_by: this.#caseAttachment.updated_by.value,
            },
        };
    }
}
