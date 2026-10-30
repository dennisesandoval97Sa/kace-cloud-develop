export class HelpsAttachmentsResponse {
    /** @type {Helps} is initialized in the constructor */
    #helpAttachment;

    /**
     *
     * @param {Helps} help
     */
    constructor(helpAttachment) {
        this.#helpAttachment = helpAttachment;
    }

    /**
     *
     * @returns {Object}
     */
    toJson() {
        if (this.#helpAttachment === null) return {};

        return {
            data: {
                id: this.#helpAttachment.id.value,
                path: this.#helpAttachment.path.value,
                tipo: this.#helpAttachment.tipo.value,
                help_id: this.#helpAttachment.help_id.value,
                created_by: this.#helpAttachment.created_by.value,
                created_at: this.#helpAttachment.created_at.value,
                updated_by: this.#helpAttachment.updated_by.value,
                updated_at: this.#helpAttachment.updated_at.value,
            },
        };
    }
}
