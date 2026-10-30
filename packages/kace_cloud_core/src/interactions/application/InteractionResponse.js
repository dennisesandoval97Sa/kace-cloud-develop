export class InteractionResponse {
    /** @type {Interaction} is initialized in the constructor */
    #interaction;
    /**
     *
     * @param {Interaction} interaction
     */
    constructor(interaction) {
        this.#interaction = interaction;
    }

    toJson() {
        if (this.#interaction === null) return {};

        const response = {
            id: this.#interaction.id.value,
            channel_id: this.#interaction.channel_id.value,
            client_identifier: this.#interaction.client_identifier.value,
            external_identifier: this.#interaction.external_identifier.value,
            description: this.#interaction.description.value,
            priority: this.#interaction.priority.value,
            workspace_id: this.#interaction.workspace_id.value,
            email_id: this.#interaction.email_id.value,
            start_review_at: this.#interaction.start_review_at.value,
            start_review_by: this.#interaction.start_review_by.value,
            conversation_id: this.#interaction.conversation_id.value,
            receipt_at: this.#interaction.receipt_at?.value,
            closed_at: this.#interaction.closed_at?.value,
            closed_by: this.#interaction.closed_by?.value,
            closed_observation: this.#interaction.closed_observation?.value,
            delete_observation: this.#interaction.delete_observation?.value,
            is_closed: this.#interaction.is_closed.value,
            in_review: this.#interaction.in_review.value,
            is_migrated: this.#interaction.is_migrated.value,
            created_by: this.#interaction.created_by?.value,
            created_at: this.#interaction.created_at?.value,
            updated_by: this.#interaction.updated_by?.value,
            updated_at: this.#interaction.updated_at?.value,
        };

        return {
            data: response,
        };
    }
}
