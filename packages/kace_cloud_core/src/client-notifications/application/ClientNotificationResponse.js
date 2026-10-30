export class ClientNotificationResponse {
    /** @type {ClientNotification} is initialized in the constructor */
    #clientNotification;

    /**
     * Creates an instance of ClientNotificationResponse.
     * @param {ClientNotification} clientNotification - The ClientNotification instance.
     */
    constructor(clientNotification) {
        this.#clientNotification = clientNotification;
    }

    /**
     * Converts the ClientNotification object to a JSON representation.
     *
     * @returns {Object} A flat object containing the client notification data.
     */
    toJson() {
        if (!this.#clientNotification) return {};

        return {
            data: {
                id: this.#clientNotification.id.value,
                client_id: this.#clientNotification.client_id.value,
                subject: this.#clientNotification.subject.value,
                message: this.#clientNotification.message.value,
                start_date: this.#clientNotification.start_date.value,
                end_date: this.#clientNotification.end_date.value,
                is_read: this.#clientNotification.is_read.value,
                read_by: this.#clientNotification.read_by.value,
                is_active: this.#clientNotification.is_active.value,
                created_at: this.#clientNotification.created_at.value,
                updated_at: this.#clientNotification.updated_at.value,
                created_by: this.#clientNotification.created_by.value,
                updated_by: this.#clientNotification.updated_by.value,
            },
        };
    }
}
